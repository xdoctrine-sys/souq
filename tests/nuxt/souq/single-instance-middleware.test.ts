import type { RouteLocationNormalized, RouteLocationRaw, RouteRecordRaw } from 'vue-router'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

/**
 * The middleware under test reads `useRuntimeConfig().public.singleInstance`, which
 * defaults to `false`; the SOUQ deployment turns it on, so the mock exposes it.
 */
const { runtimeConfig } = vi.hoisted(() => ({
  runtimeConfig: { public: { singleInstance: true } },
}))

mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig)

type GlobalMiddleware = (
  to: RouteLocationNormalized,
) => RouteLocationRaw | undefined | Promise<RouteLocationRaw | undefined>

/**
 * `#build/routes.mjs` is the real route table generated from `app/pages`, so the matcher
 * behaves exactly like in the app (`account-index` is `/:server?/@:account()`). Its
 * components are replaced with stubs: this test only exercises the router and the
 * middleware, never the pages themselves.
 */
function stubComponents(records: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  return records.map((record) => {
    const { component: _component, components: _components, children, ...rest } = record as RouteRecordRaw & { component?: unknown, components?: unknown }
    return {
      ...rest,
      component: { render: () => null },
      ...(children ? { children: stubComponents(children as readonly RouteRecordRaw[]) } : {}),
    } as RouteRecordRaw
  })
}

async function loadMiddleware(): Promise<GlobalMiddleware> {
  const { default: middleware } = await import('~/middleware/2.single-instance.global')
  return middleware as GlobalMiddleware
}

/**
 * Navigates for real, with the middleware registered as a global guard, exactly like
 * the Nuxt router plugin does. The number of guard invocations is asserted: a guard
 * that keeps re-returning the same server-prefixed location re-enters forever, which is
 * what froze `/{server}/@account` in production (vue-router aborts after 30 nested
 * redirects, but only after the main thread has already been monopolised).
 */
async function navigate(start: string) {
  const { default: routes } = await import('#build/routes.mjs')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: stubComponents(routes as readonly RouteRecordRaw[]),
  })
  const middleware = await loadMiddleware()

  let guardRuns = 0
  router.beforeEach(async (to) => {
    guardRuns++
    const result = await middleware(to)
    if (result)
      return result
  })

  await router.push(start)
  return { router, guardRuns }
}

/**
 * Reproduces what the browser actually goes through on `/{server}/@account`: the page is
 * hydrated at the prefixed URL (so the current route already carries `params.server`),
 * then Nuxt's `app:created` hook replays that same location with a forced replace
 * (`nuxt/dist/pages/runtime/plugins/router.js`). Only in that state does the broken
 * middleware keep re-entering, so this helper is the one that must fail before the fix.
 */
async function navigateFromPrefixedCurrentRoute(start: string) {
  const { default: routes } = await import('#build/routes.mjs')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: stubComponents(routes as readonly RouteRecordRaw[]),
  })
  const middleware = await loadMiddleware()

  let guardRuns = 0
  router.beforeEach(async (to) => {
    guardRuns++
    // vue-router re-enters the guard synchronously on every redirect it resolves, so a
    // middleware that never strips the prefix would spin the event loop and hang the test
    // run (exactly what freezes the tab). Bail out with a diagnostic instead.
    if (guardRuns > 50)
      throw new Error(`single-instance middleware re-entered ${guardRuns} times: server prefix not stripped`)
    const result = await middleware(to)
    if (result)
      return result
  })

  // Install the prefixed location as the current route, with the middleware inert.
  runtimeConfig.public.singleInstance = false
  await router.push(start)

  runtimeConfig.public.singleInstance = true
  const before = guardRuns

  // Same shape as Nuxt's bootstrap: the resolved initial route, its name cleared, replayed
  // with `force`. vue-router aborts after 30 nested redirects and rejects, which is how the
  // broken code surfaces here (instead of monopolising the main thread as it does in a tab).
  const resolved = router.resolve(start)
  resolved.name = undefined
  let redirectionError: unknown
  try {
    await router.replace({ ...resolved, force: true })
  }
  catch (error) {
    redirectionError = error
  }
  return { router, guardRuns: guardRuns - before, redirectionError }
}

describe('single-instance middleware: server prefix stripping', () => {
  beforeEach(() => {
    runtimeConfig.public.singleInstance = true
  })

  it('strips the server prefix from an account page without re-entering', async () => {
    const { router, guardRuns } = await navigate('/souq.localhost:3443/@trae_test')

    expect(router.currentRoute.value.path).toBe('/@trae_test')
    expect(router.currentRoute.value.params.server).toBeFalsy()
    expect(router.currentRoute.value.params.account).toBe('trae_test')
    expect(guardRuns).toBeLessThanOrEqual(2)
  })

  it('strips the server prefix from a public page without re-entering', async () => {
    const { router, guardRuns } = await navigate('/souq.localhost:3443/public/local')

    expect(router.currentRoute.value.path).toBe('/public/local')
    expect(router.currentRoute.value.params.server).toBeFalsy()
    expect(guardRuns).toBeLessThanOrEqual(2)
  })

  it('leaves a prefix-free route untouched', async () => {
    const { router, guardRuns } = await navigate('/@trae_test')

    expect(router.currentRoute.value.path).toBe('/@trae_test')
    expect(router.currentRoute.value.params.server).toBeFalsy()
    expect(guardRuns).toBe(1)
  })

  it('does nothing when the instance is not configured as single instance', async () => {
    runtimeConfig.public.singleInstance = false
    const { router, guardRuns } = await navigate('/souq.localhost:3443/@trae_test')

    expect(router.currentRoute.value.path).toBe('/souq.localhost:3443/@trae_test')
    expect(router.currentRoute.value.params.server).toBe('souq.localhost:3443')
    expect(guardRuns).toBe(1)
  })

  it('unfreezes a profile page hydrated at the server-prefixed URL', async () => {
    const { router, guardRuns, redirectionError } = await navigateFromPrefixedCurrentRoute('/souq.localhost:3443/@trae_test')

    expect(redirectionError).toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/@trae_test')
    expect(router.currentRoute.value.params.server).toBeFalsy()
    expect(router.currentRoute.value.params.account).toBe('trae_test')
    expect(guardRuns).toBeLessThanOrEqual(2)
  })
})

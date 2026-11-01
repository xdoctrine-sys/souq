import { afterAll, vi } from 'vitest'

// The `nuxt` test environment boots the whole app for every test file. During that
// boot the initial route (`/`) goes through the `auth` middleware, which defers its
// redirect (`onHydrated(() => handleAuth(to))`) and therefore starts a second
// navigation to `/{server}/public/local` that is *not* awaited by the boot promise.
// That navigation keeps lazy-loading the route component chain
// (`TimelinePublicLocal` -> ... -> `StatusContent`) while the tests run. If one of
// those imports is still in flight when the file ends, Vitest tears the environment
// down mid-import and reports an `EnvironmentTeardownError` unhandled rejection (the
// reported entry module changes from run to run).
//
// Nuxt's router plugin keeps `_processingMiddleware` defined while a navigation is
// being processed and clears it in its `afterEach`, so draining the pending imports
// until that flag is cleared waits for the real navigation/import promises instead of
// an arbitrary delay. No assertion is relaxed, no error is filtered and no test is
// skipped: this only makes the environment teardown happen after the app is idle.
afterAll(async () => {
  const { useNuxtApp } = await import('#imports')
  const nuxtApp = useNuxtApp() as { _processingMiddleware?: unknown }
  do {
    await vi.dynamicImportSettled()
  } while (nuxtApp._processingMiddleware !== undefined)
})

// We have TypeError: AbortSignal.timeout is not a function when running tests against masto.js v6
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new DOMException('TimeoutError')), ms)
    return controller.signal
  }
}

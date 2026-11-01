import type { DraftItem } from '#shared/types'
import type { mastodon } from 'masto'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onErrorCaptured, ref, Suspense } from 'vue'
import { createI18n } from 'vue-i18n'
import PublishWidget from '~/components/publish/PublishWidget.vue'
import { getDefaultDraftItem } from '~/composables/masto/statusDrafts'
import { isHydrated } from '~/composables/vue'

/**
 * The publish form (`PublishWidget.vue`) probes the on-device model API at setup and
 * again while the user types (`detectLanguage`). Chromium can advertise the API while
 * the model itself is unavailable, so `availability()` and `create()` may both reject
 * with `NotSupportedError: Model not available`. Neither must break the composer or
 * leak an unhandled promise rejection.
 *
 * These tests mount the real form; only the network/editor boundaries are replaced so
 * the assertions stay on the form's own wiring.
 */

const model = vi.hoisted(() => ({
  availability: vi.fn(),
  create: vi.fn(),
  publish: vi.fn(),
  editorHtml: { value: '' },
}))

/**
 * `mockNuxtImport` factories are hoisted above the imports, so `ref()` cannot be
 * imported there. `proxyRefs` (used by the template to auto-unwrap bindings) only
 * checks `__v_isRef`, so a plain object flagged as a ref behaves like one both in
 * the composables (`currentUser.value`) and in the template (`currentUser.account`).
 */
const currentUserMock = vi.hoisted(() => ({
  __v_isRef: true,
  value: {
    account: { id: '1', acct: 'trae_test', source: { language: 'ar-EG' } },
  },
}))

/** Replace the on-device model global with controllable functions. */
function stubOnDeviceModelApi() {
  Object.assign(globalThis, {
    LanguageDetector: {
      availability: model.availability,
      create: model.create,
    },
  })
}

mockNuxtImport('useMasto', () => () => ({
  client: { value: { v1: { statuses: { create: model.publish }, media: {} } } },
}))

mockNuxtImport('useTiptap', () => () => ({
  editor: { value: { getHTML: () => model.editorHtml.value } },
}))

mockNuxtImport('useUserSettings', () => () => ({
  value: { preferences: {}, language: 'en', disabledTranslationLanguages: [] },
}))

// `currentUser` is read by `usePublish` (preferred language) and by the form template.
mockNuxtImport('currentUser', () => currentUserMock)

mockNuxtImport('currentInstance', () => ({ value: null }))

mockNuxtImport('useWebShareTarget', () => () => {})

// `EditorContent` is the only consumer needed from tiptap: keep the `@keyup` wiring
// that drives `detectLanguage`, drop the real editor. Keep the original exports so the
// other tiptap consumers pulled in by the app (e.g. node views) still resolve.
vi.mock('@tiptap/vue-3', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tiptap/vue-3')>()
  const { defineComponent, h } = await import('vue')
  return {
    ...original,
    EditorContent: defineComponent({
      name: 'EditorContent',
      setup(_props, { attrs }) {
        return () => h('div', { class: 'editor-content-stub', onKeyup: (attrs as { onKeyup?: unknown }).onKeyup })
      },
    }),
  }
})

isHydrated.value = true

/** Passes the default slot through, so the publish button stays findable. */
const PassthroughStub = defineComponent({
  name: 'PassthroughStub',
  setup(_props, { slots }) {
    // A single root node keeps the fallthrough attributes (tooltip placement, ...)
    // inheritable, which avoids the noisy "Extraneous non-props attributes" warning.
    return () => h('span', slots.default?.())
  },
})

/** Renders a link without needing the router context. */
const LinkStub = defineComponent({
  name: 'LinkStub',
  setup(_props, { slots }) {
    return () => h('a', slots.default?.())
  },
})

const NoopStub = defineComponent({
  name: 'NoopStub',
  setup() {
    return () => null
  },
})

/** Renders the scoped slot with a neutral value (visibility / quote pickers). */
function scopedStub(value: unknown) {
  return defineComponent({
    name: 'ScopedStub',
    setup(_props, { slots }) {
      return () => h('span', slots.default?.(value))
    },
  })
}

const globalStubs = {
  NuxtLink: LinkStub,
  RouterLink: LinkStub,
  VDropdown: NoopStub,
  CommonTooltip: PassthroughStub,
  AccountBigAvatar: NoopStub,
  PublishEmojiPicker: NoopStub,
  PublishEditorTools: NoopStub,
  PublishCharacterCounter: NoopStub,
  PublishThreadTools: NoopStub,
  PublishVisibilityPicker: scopedStub({ visibility: { icon: 'i-ri-globe-line' } }),
}

/**
 * The nuxt-i18n module augments `vue-i18n` so `messages` must list every
 * configured locale; the composer only needs a locale to exist, so the
 * overloads are bypassed here rather than filled with 38 unrelated catalogs.
 */
const createI18nForTest = createI18n as unknown as (
  options: Record<string, unknown>,
) => ReturnType<typeof createI18n>

function makeI18n() {
  return createI18nForTest({
    legacy: false,
    locale: 'en-US',
    fallbackLocale: 'en-US',
    messages: { 'en-US': {} },
  })
}

const unhandled: unknown[] = []
function onUnhandledRejection(reason: unknown) {
  unhandled.push(reason)
}

beforeEach(() => {
  vi.clearAllMocks()
  unhandled.length = 0
  process.on('unhandledRejection', onUnhandledRejection)
  model.editorHtml.value = '<p>Bonjour, ceci est un brouillon de test assez long.</p>'
  model.publish.mockResolvedValue({ id: 'status-1', content: '<p>x</p>' } as unknown as mastodon.v1.Status)
  stubOnDeviceModelApi()
})

afterEach(() => {
  process.off('unhandledRejection', onUnhandledRejection)
  delete (globalThis as { LanguageDetector?: unknown }).LanguageDetector
  vi.restoreAllMocks()
})

function makeThreadComposer() {
  const draftItem: DraftItem = getDefaultDraftItem({
    status: '<p>Bonjour, ceci est un brouillon de test assez long.</p>',
    language: 'ar',
  })
  const threadItems = ref<DraftItem[]>([draftItem])
  return {
    draftItem,
    composer: {
      threadItems,
      threadIsActive: computed(() => false),
      threadIsSending: ref(false),
      addThreadItem: vi.fn(),
      removeThreadItem: vi.fn(),
      publishThread: vi.fn(),
    },
  }
}

/**
 * `PublishWidget` awaits the model probe inside its `setup`, so it has to run
 * inside a `Suspense` boundary; the form body only exists once that boundary
 * resolved, hence the `flushPromises()` before returning.
 */
async function mountForm() {
  const { composer, draftItem } = makeThreadComposer()
  const props = {
    draftKey: 'home' as const,
    draftItemIndex: 0,
    threadComposer: composer as never,
    expanded: true,
    initial: () => getDefaultDraftItem({ language: 'ar' }),
  }
  const errors: unknown[] = []
  const Host = defineComponent({
    name: 'PublishFormHost',
    setup() {
      onErrorCaptured((err) => {
        errors.push(err)
        return false
      })
      return () => h(Suspense, null, { default: () => h(PublishWidget, props) })
    },
  })
  const wrapper = mount(Host, {
    global: { plugins: [makeI18n()], stubs: globalStubs },
  })
  await flushPromises()
  return { wrapper, draftItem, errors }
}

/** Lets the microtask queue and the node unhandled-rejection hook run. */
async function flushRejections() {
  await new Promise(resolve => setTimeout(resolve, 0))
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('publish form when the on-device model API is broken', () => {
  it('keeps the composer usable when availability() rejects', async () => {
    model.availability.mockRejectedValue(new Error('Model not available'))
    model.create.mockResolvedValue({ detect: vi.fn() })

    const { wrapper, errors } = await mountForm()
    expect(errors).toEqual([])

    await wrapper.find('.publish-button').trigger('click')
    await flushRejections()

    expect(model.publish).toHaveBeenCalledTimes(1)
    expect(unhandled).toEqual([])
    wrapper.unmount()
  })

  it('keeps the composer usable when create() rejects during setup', async () => {
    model.availability.mockResolvedValue('unavailable')
    model.create.mockRejectedValue(new Error('Model not available'))

    const { wrapper } = await mountForm()
    await flushRejections()

    await wrapper.find('.publish-button').trigger('click')
    await flushRejections()

    expect(model.publish).toHaveBeenCalledTimes(1)
    expect(unhandled).toEqual([])
    wrapper.unmount()
  })

  it('preserves the chosen language and the form when create() rejects while typing', async () => {
    model.availability.mockResolvedValue('available')
    model.create.mockRejectedValue(new Error('Model not available'))

    const { wrapper, draftItem } = await mountForm()
    expect(draftItem.params.language).toBe('ar')

    await wrapper.find('.editor-content-stub').trigger('keyup')
    // `detectLanguage` is debounced (500 ms) before it calls `create()`.
    await new Promise(resolve => setTimeout(resolve, 700))
    await flushRejections()

    expect(model.create).toHaveBeenCalled()
    // The detected language is discarded, but the chosen one is left intact.
    expect(draftItem.params.language).toBe('ar')
    expect(unhandled).toEqual([])

    // The form must remain publishable after the failed detection.
    await wrapper.find('.publish-button').trigger('click')
    await flushRejections()
    expect(model.publish).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})

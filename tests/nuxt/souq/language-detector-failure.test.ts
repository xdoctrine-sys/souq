import type { mastodon } from 'masto'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The on-device model API can be exposed by the browser while the model itself is
 * unavailable: `create()` then rejects (Chromium raises
 * `NotSupportedError: Model not available`). `translate.ts` used to await it outside
 * any `try`, so `toggle()` rejected and `StatusTranslation.vue` never reset its
 * spinner. This test guards the corrected behaviour.
 *
 * `translate.ts` reads `'Translator' in globalThis` at module load, so the globals
 * must be stubbed before the module is imported, and the module cache reset between
 * tests.
 */
function stubOnDeviceModelApi(create: () => Promise<unknown>) {
  const api = () => ({
    availability: vi.fn().mockResolvedValue('available'),
    create: vi.fn(create),
  })
  Object.assign(globalThis, { Translator: api(), LanguageDetector: api() })
}

function makeStatus(language: string): mastodon.v1.Status {
  return {
    id: 'status-1',
    content: '<p>Bonjour depuis SOUQ</p>',
    language,
  } as unknown as mastodon.v1.Status
}

async function loadUseTranslation() {
  vi.resetModules()
  const { useTranslation } = await import('~/composables/masto/translate')
  return useTranslation
}

afterEach(() => {
  vi.resetModules()
  delete (globalThis as any).Translator
  delete (globalThis as any).LanguageDetector
})

describe('useTranslation when the on-device model cannot be created', () => {
  it('records the failure instead of letting toggle() reject', async () => {
    stubOnDeviceModelApi(() => Promise.reject(new Error('Model not available')))
    const useTranslation = await loadUseTranslation()

    const { enabled, toggle, translation } = await useTranslation(makeStatus('fr'), 'en')

    expect(enabled).toBe(true)
    await expect(toggle()).resolves.toBeUndefined()
    expect(translation.success).toBe(false)
    expect(translation.error).toBe('Model not available')
    expect(translation.text).toBe('')
  })

  it('still exposes the untranslated text when the button is toggled off', async () => {
    stubOnDeviceModelApi(() => Promise.reject(new Error('Model not available')))
    const useTranslation = await loadUseTranslation()

    const { toggle, translation } = await useTranslation(makeStatus('fr'), 'en')
    await toggle()
    // `visible` is flipped by `toggle()` in both outcomes, so the button stays usable.
    expect(translation.visible).toBe(true)
  })
})

describe('useTranslation when the on-device model is available', () => {
  it('keeps translating the status', async () => {
    const translate = vi.fn().mockResolvedValue('<p>Hello from SOUQ</p>')
    stubOnDeviceModelApi(() => Promise.resolve({ translate }))
    const useTranslation = await loadUseTranslation()

    const { toggle, translation } = await useTranslation(makeStatus('fr'), 'en')
    await toggle()

    expect(translate).toHaveBeenCalledWith('<p>Bonjour depuis SOUQ</p>')
    expect(translation.success).toBe(true)
    expect(translation.error).toBe('')
    expect(translation.text).toBe('<p>Hello from SOUQ</p>')
  })
})

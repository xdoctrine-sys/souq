import type { mastodon } from 'masto'
import type { SouqListing, SouqListingPrice } from '~/types/souq'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import SouqListingCard from '~/components/souq/SouqListingCard.vue'
import { isHydrated } from '~/composables/vue'
import ar from '../../../locales/ar.json'
import en from '../../../locales/en.json'

// The SOUQ `t()` wrapper returns an empty string until the app is hydrated.
isHydrated.value = true

type SouqLocale = 'en-US' | 'ar-EG'

/**
 * The nuxt-i18n module augments `vue-i18n` so `messages` must list every
 * configured locale; the card only needs the two SOUQ ones, so the overloads
 * are bypassed here rather than filled with 38 unrelated catalogs.
 */
const createI18nForTest = createI18n as unknown as (
  options: Record<string, unknown>,
) => ReturnType<typeof createI18n>

function makeI18n(locale: SouqLocale = 'en-US') {
  return createI18nForTest({
    legacy: false,
    locale,
    fallbackLocale: 'en-US',
    messages: { 'ar-EG': ar, 'en-US': en },
  })
}

function makePrice(overrides: Partial<SouqListingPrice> = {}): SouqListingPrice {
  return {
    mode: 'fixed',
    amount: '145000.00',
    minor: 14500000,
    currency: 'QAR',
    period: 'once',
    ...overrides,
  }
}

function makeListing(overrides: Partial<SouqListing> = {}): SouqListing {
  return {
    id: 'listing-1',
    title: 'Toyota Land Cruiser 2019',
    category: { code: 'cars', nameEn: 'Cars', nameAr: 'سيارات', path: ['vehicles', 'cars'] },
    price: makePrice(),
    location: { code: 'doha', nameEn: 'Doha', nameAr: 'الدوحة' },
    attributes: [],
    state: 'active',
    taxonomyVersion: 1,
    ...overrides,
  }
}

/** A status with `souqListing` omitted entirely when `listing` is `undefined`. */
function makeStatus(listing?: SouqListing | null): mastodon.v1.Status {
  const status: Record<string, unknown> = { id: 'status-1' }
  if (listing !== undefined)
    status.souqListing = listing
  return status as unknown as mastodon.v1.Status
}

function mountCard(status: mastodon.v1.Status, locale: SouqLocale = 'en-US') {
  return mount(SouqListingCard, {
    props: { status },
    global: { plugins: [makeI18n(locale)] },
  })
}

describe('souq listing card visibility', () => {
  it('renders a card for a listing', () => {
    const wrapper = mountCard(makeStatus(makeListing()))
    expect(wrapper.find('.souq-listing-card').exists()).toBe(true)
    expect(wrapper.find('.souq-listing-card-title').text()).toBe('Toyota Land Cruiser 2019')
  })

  it('renders nothing without a listing', () => {
    expect(mountCard(makeStatus()).find('.souq-listing-card').exists()).toBe(false)
    expect(mountCard(makeStatus(null)).find('.souq-listing-card').exists()).toBe(false)
  })

  it('never shows a hidden listing', () => {
    const wrapper = mountCard(makeStatus(makeListing({ state: 'hidden' })))
    expect(wrapper.find('.souq-listing-card').exists()).toBe(false)
  })
})

describe('souq listing card price modes', () => {
  it('fixed shows the amount and the currency', () => {
    const wrapper = mountCard(makeStatus(makeListing({ price: makePrice({ mode: 'fixed' }) })))
    const amount = wrapper.find('.souq-listing-card-price-amount')
    expect(amount.text()).toContain('145,000')
    expect(amount.text()).toContain('QAR')
    expect(wrapper.find('.souq-listing-card-price-negotiable').exists()).toBe(false)
  })

  it('negotiable shows the amount and the negotiable mention', () => {
    const wrapper = mountCard(makeStatus(makeListing({ price: makePrice({ mode: 'negotiable' }) })))
    expect(wrapper.find('.souq-listing-card-price-amount').text()).toContain('145,000')
    expect(wrapper.find('.souq-listing-card-price-negotiable').text()).toBe('Negotiable')
  })

  it('on_request shows the price on request mention', () => {
    const wrapper = mountCard(makeStatus(makeListing({ price: makePrice({ mode: 'on_request', amount: null, minor: null, currency: null }) })))
    expect(wrapper.find('.souq-listing-card-price-on-request').text()).toBe('Price on request')
    expect(wrapper.find('.souq-listing-card-price-amount').exists()).toBe(false)
  })

  it('free shows the free mention', () => {
    const wrapper = mountCard(makeStatus(makeListing({ price: makePrice({ mode: 'free', amount: null, minor: null, currency: null }) })))
    expect(wrapper.find('.souq-listing-card-price-free').text()).toBe('Free')
  })

  it('none shows no price at all', () => {
    const wrapper = mountCard(makeStatus(makeListing({ price: makePrice({ mode: 'none', amount: null, minor: null, currency: null }) })))
    expect(wrapper.find('.souq-listing-card-price').exists()).toBe(false)
  })

  it('adds the period only when it is not once', () => {
    expect(mountCard(makeStatus(makeListing({ price: makePrice({ period: 'day' }) }))).find('.souq-listing-card-price-period').text()).toBe('per day')
    expect(mountCard(makeStatus(makeListing({ price: makePrice({ period: 'week' }) }))).find('.souq-listing-card-price-period').text()).toBe('per week')
    expect(mountCard(makeStatus(makeListing({ price: makePrice({ period: 'month' }) }))).find('.souq-listing-card-price-period').text()).toBe('per month')
    expect(mountCard(makeStatus(makeListing({ price: makePrice({ period: 'year' }) }))).find('.souq-listing-card-price-period').text()).toBe('per year')
    expect(mountCard(makeStatus(makeListing({ price: makePrice({ period: 'once' }) }))).find('.souq-listing-card-price-period').exists()).toBe(false)
  })
})

describe('souq listing card state', () => {
  it('shows a badge for sold, reserved and expired', () => {
    const sold = mountCard(makeStatus(makeListing({ state: 'sold' })))
    expect(sold.attributes('data-state')).toBe('sold')
    expect(sold.find('.souq-listing-card-state').text()).toBe('Sold')

    expect(mountCard(makeStatus(makeListing({ state: 'reserved' }))).find('.souq-listing-card-state').text()).toBe('Reserved')
    expect(mountCard(makeStatus(makeListing({ state: 'expired' }))).find('.souq-listing-card-state').text()).toBe('Expired')
  })

  it('shows no badge for an active listing', () => {
    expect(mountCard(makeStatus(makeListing({ state: 'active' }))).find('.souq-listing-card-state').exists()).toBe(false)
  })
})

describe('souq listing card content', () => {
  it('renders the category and the location', () => {
    const wrapper = mountCard(makeStatus(makeListing()))
    expect(wrapper.find('.souq-listing-card-category').text()).toBe('Cars')
    expect(wrapper.find('.souq-listing-card-location').text()).toBe('Doha')
  })

  it('renders neutral attribute pairs and tolerates an empty list', () => {
    const withAttributes = mountCard(makeStatus(makeListing({ attributes: [{ code: 'mileage', value: '120000' }, { code: 'fuel', value: 'diesel' }] })))
    expect(withAttributes.findAll('.souq-listing-card-attribute')).toHaveLength(2)
    expect(withAttributes.text()).toContain('mileage')
    expect(withAttributes.text()).toContain('120000')

    expect(mountCard(makeStatus(makeListing({ attributes: [] }))).find('.souq-listing-card-attributes').exists()).toBe(false)
  })

  it('renders the title as plain text, never as html', () => {
    const wrapper = mountCard(makeStatus(makeListing({ title: '<b>x</b>' })))
    const title = wrapper.find('.souq-listing-card-title')
    expect(title.text()).toBe('<b>x</b>')
    expect(title.find('b').exists()).toBe(false)
    expect(title.element.innerHTML).toBe('&lt;b&gt;x&lt;/b&gt;')
  })

  it('renders arabic labels for an arabic interface', () => {
    const wrapper = mountCard(makeStatus(makeListing({ state: 'sold', price: makePrice({ mode: 'negotiable' }) })), 'ar-EG')
    expect(wrapper.find('.souq-listing-card-state').text()).toBe('مباع')
    expect(wrapper.find('.souq-listing-card-category').text()).toBe('سيارات')
    expect(wrapper.find('.souq-listing-card-location').text()).toBe('الدوحة')
    expect(wrapper.find('.souq-listing-card-price-negotiable').text()).toBe('قابل للتفاوض')
  })
})

describe('souq listing card refresh', () => {
  it('redraws when the status object is replaced', async () => {
    const wrapper = mountCard(makeStatus(makeListing({ state: 'active' })))
    expect(wrapper.find('.souq-listing-card-state').exists()).toBe(false)

    await wrapper.setProps({ status: makeStatus(makeListing({ state: 'sold' })) })
    expect(wrapper.find('.souq-listing-card-state').text()).toBe('Sold')
  })

  it('redraws when the timeline replaces the status in its array (paginator behaviour)', async () => {
    const items = ref<mastodon.v1.Status[]>([makeStatus(makeListing({ state: 'active' }))])
    const Host = defineComponent(() => () => h(SouqListingCard, { status: items.value[0] }))
    const wrapper = mount(Host, { global: { plugins: [makeI18n()] } })
    expect(wrapper.find('.souq-listing-card-state').exists()).toBe(false)

    // Same mutation as `app/composables/paginator.ts` on a `status.update` event.
    items.value[0] = makeStatus(makeListing({ state: 'sold' }))
    await nextTick()
    expect(wrapper.find('.souq-listing-card-state').text()).toBe('Sold')
  })
})

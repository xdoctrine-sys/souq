<script setup lang="ts">
import type { mastodon } from 'masto'
import type { SouqListing } from '~/types/souq'
import { formatSouqAmount, souqCategoryLabel, souqLocationLabel } from '~/composables/souq/listing'

/**
 * SOUQ listing attached to a status, rendered inside the status body (timeline
 * and details). Every string comes from the `souq.listing` translation keys;
 * the title, the category and the location are plain text from the API and are
 * never interpreted as HTML.
 */
const { status } = defineProps<{
  status: mastodon.v1.Status | mastodon.v1.StatusEdit
}>()

const { t, locale } = useI18n()

const listing = computed<SouqListing | undefined>(() => 'souqListing' in status ? status.souqListing ?? undefined : undefined)

// `hidden` listings are not shown to a visitor at all.
const visible = computed(() => !!listing.value && listing.value.state !== 'hidden')

const categoryLabel = computed(() => souqCategoryLabel(listing.value?.category, locale.value) ?? t('souq.listing.category_unknown'))
const locationLabel = computed(() => listing.value?.location ? souqLocationLabel(listing.value.location, locale.value) : t('souq.listing.location_unknown'))

const priceFreeLabel = computed(() => listing.value?.price.mode === 'free' ? t('souq.listing.price.free') : undefined)
const priceOnRequestLabel = computed(() => listing.value?.price.mode === 'on_request' ? t('souq.listing.price.on_request') : undefined)

const priceAmountLabel = computed(() => {
  const price = listing.value?.price
  if (!price || (price.mode !== 'fixed' && price.mode !== 'negotiable'))
    return undefined

  return price.amount && price.currency
    ? formatSouqAmount(price.amount, price.currency, locale.value)
    : t('souq.listing.price.unknown')
})

const priceNegotiableLabel = computed(() => listing.value?.price.mode === 'negotiable' ? t('souq.listing.price.negotiable') : undefined)

const pricePeriodLabel = computed(() => {
  switch (listing.value?.price.period) {
    case 'day': return t('souq.listing.price.period.day')
    case 'week': return t('souq.listing.price.period.week')
    case 'month': return t('souq.listing.price.period.month')
    case 'year': return t('souq.listing.price.period.year')
    default: return undefined
  }
})

const stateLabel = computed(() => {
  switch (listing.value?.state) {
    case 'sold': return t('souq.listing.state.sold')
    case 'reserved': return t('souq.listing.state.reserved')
    case 'expired': return t('souq.listing.state.expired')
    default: return undefined
  }
})

const attributes = computed(() => listing.value?.attributes ?? [])
</script>

<template>
  <div v-if="visible && listing" class="souq-listing-card" :data-state="listing.state">
    <div class="souq-listing-card-head">
      <span class="souq-listing-card-title">{{ listing.title }}</span>
      <span v-if="stateLabel" class="souq-listing-card-state">{{ stateLabel }}</span>
    </div>

    <div class="souq-listing-card-meta">
      <span class="souq-listing-card-category">{{ categoryLabel }}</span>
      <span v-if="locationLabel" class="souq-listing-card-location">{{ locationLabel }}</span>
    </div>

    <div v-if="priceFreeLabel || priceOnRequestLabel || priceAmountLabel" class="souq-listing-card-price">
      <span v-if="priceFreeLabel" class="souq-listing-card-price-free">{{ priceFreeLabel }}</span>
      <span v-else-if="priceOnRequestLabel" class="souq-listing-card-price-on-request">{{ priceOnRequestLabel }}</span>
      <template v-else>
        <span class="souq-listing-card-price-amount">{{ priceAmountLabel }}</span>
        <span v-if="priceNegotiableLabel" class="souq-listing-card-price-negotiable">{{ priceNegotiableLabel }}</span>
        <span v-if="pricePeriodLabel" class="souq-listing-card-price-period">{{ pricePeriodLabel }}</span>
      </template>
    </div>

    <ul v-if="attributes.length" class="souq-listing-card-attributes">
      <li v-for="attribute in attributes" :key="attribute.code" class="souq-listing-card-attribute">
        <span class="souq-listing-card-attribute-code">{{ attribute.code }}</span>
        <span class="souq-listing-card-attribute-value">{{ attribute.value }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Logical properties only (start/end), so the card follows the document
   direction: left-to-right in English, right-to-left in Arabic. */
.souq-listing-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-block-start: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--c-border);
  border-radius: 0.5rem;
  background-color: var(--c-bg-card);
  text-align: start;
}

.souq-listing-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.souq-listing-card-title {
  font-weight: 600;
  color: var(--c-text-base);
}

.souq-listing-card-state {
  padding-inline: 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  line-height: 1.5rem;
  color: var(--c-text-base);
  background-color: var(--c-bg-active);
}

.souq-listing-card[data-state='sold'] .souq-listing-card-state {
  color: var(--c-text-btn-disabled);
  background-color: var(--c-bg-btn-disabled);
}

.souq-listing-card[data-state='reserved'] .souq-listing-card-state {
  color: #fff;
  background-color: var(--c-warning);
}

.souq-listing-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--c-text-secondary);
}

.souq-listing-card-price {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  font-weight: 600;
}

.souq-listing-card-price-negotiable,
.souq-listing-card-price-period {
  font-weight: 400;
  color: var(--c-text-secondary);
}

.souq-listing-card-attributes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
}

.souq-listing-card-attribute {
  display: flex;
  gap: 0.25rem;
  padding-inline: 0.5rem;
  border: 1px solid var(--c-border);
  border-radius: 0.375rem;
  color: var(--c-text-secondary);
}

.souq-listing-card-attribute-value {
  color: var(--c-text-base);
}
</style>

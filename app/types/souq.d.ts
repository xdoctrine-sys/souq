/**
 * SOUQ types for the `souq_listing` field a status carries beside its Mastodon
 * payload (SOUQ_CATEGORIES_DESIGN.md section 7.1).
 *
 * masto deserializes every payload key to camelCase with the very same code
 * path for REST responses and for streaming events (`status.update`
 * included), so the wire names (`name_en`, `taxonomy_version`, ...) appear
 * here as `nameEn`, `taxonomyVersion`, and so on.
 */
export interface SouqListingCategory {
  code: string
  nameEn: string
  nameAr: string
  /** Category codes from the root to the leaf (`['vehicles', 'cars']`). */
  path: string[]
}

export type SouqListingPriceMode = 'fixed' | 'negotiable' | 'on_request' | 'free' | 'none'
export type SouqListingPricePeriod = 'once' | 'day' | 'week' | 'month' | 'year'

/**
 * `amount` is the decimal string the API sends (`'145000.00'`); `minor` is the
 * same value in minor units. Format `amount`, never derive it from `minor`.
 */
export interface SouqListingPrice {
  mode: SouqListingPriceMode
  amount: string | null
  minor: number | null
  currency: string | null
  period: SouqListingPricePeriod
}

export interface SouqListingLocation {
  code: string
  nameEn: string
  nameAr: string
}

/** A listing attribute, shown as a neutral `{ code, value }` pair (labels land in T4/T6). */
export interface SouqListingAttribute {
  code: string
  value: string
}

export type SouqListingState = 'active' | 'reserved' | 'sold' | 'expired' | 'hidden'

export interface SouqListing {
  id: string
  title: string
  category: SouqListingCategory | null
  price: SouqListingPrice
  location: SouqListingLocation | null
  attributes: SouqListingAttribute[]
  state: SouqListingState
  taxonomyVersion: number
}

/**
 * `mastodon.v1.Status` is re-exported through `masto` by a chain of
 * `export type *` (`entities/index.js` -> `v1/index.js` -> `status.js`).
 * The augmentation must target the module that declares the interface
 * (`masto/mastodon/entities/v1/status.js`); declaring it on the re-exporting
 * `v1/index.js` (as `shared/types/global.d.ts` does) would shadow the names
 * that other augmentations export from that module.
 */
declare module 'masto/mastodon/entities/v1/status.js' {
  interface Status {
    /** SOUQ listing attached to the status; absent when the status is not a listing. */
    souqListing?: SouqListing | null
  }
}

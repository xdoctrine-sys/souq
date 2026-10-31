import type { SouqListingCategory, SouqListingLocation } from '~/types/souq'

/** SOUQ types in the UI are keyed by a display name and a code fallback. */
export interface SouqNamedEntry {
  code?: string | null
  nameEn?: string | null
  nameAr?: string | null
  path?: string[]
}

export function isArabicLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith('ar')
}

/** The display name of a taxonomy entry: interface language first, code as the fallback. */
export function souqDisplayName(entry: SouqNamedEntry | null | undefined, locale: string): string | undefined {
  if (!entry)
    return undefined

  const arabic = isArabicLocale(locale)
  const primary = arabic ? entry.nameAr : entry.nameEn
  const secondary = arabic ? entry.nameEn : entry.nameAr

  return primary || secondary || entry.code || undefined
}

export function souqCategoryLabel(category: SouqListingCategory | null | undefined, locale: string): string | undefined {
  if (!category)
    return undefined

  return souqDisplayName(category, locale) ?? category.path?.at(-1) ?? undefined
}

export function souqLocationLabel(location: SouqListingLocation | null | undefined, locale: string): string | undefined {
  return souqDisplayName(location, locale)
}

/**
 * Formats the decimal `amount` string with the listing currency. `Intl` throws
 * on an unknown currency code, so a plain `amount currency` string is used then.
 */
export function formatSouqAmount(amount: string, currency: string, locale: string): string {
  const value = Number(amount)

  if (!Number.isFinite(value))
    return `${amount} ${currency}`

  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
  }
  catch {
    return `${amount} ${currency}`
  }
}

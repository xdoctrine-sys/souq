import type { SouqListingCategory, SouqListingLocation } from '../../../app/types/souq'
import { describe, expect, it } from 'vitest'
import {
  formatSouqAmount,
  isArabicLocale,
  souqCategoryLabel,
  souqDisplayName,
  souqLocationLabel,
} from '../../../app/composables/souq/listing'

const category: SouqListingCategory = {
  code: 'cars',
  nameEn: 'Cars',
  nameAr: 'سيارات',
  path: ['vehicles', 'cars'],
}

const location: SouqListingLocation = {
  code: 'doha',
  nameEn: 'Doha',
  nameAr: 'الدوحة',
}

describe('souq listing helpers', () => {
  it('detects arabic locales', () => {
    expect(isArabicLocale('ar')).toBe(true)
    expect(isArabicLocale('ar-EG')).toBe(true)
    expect(isArabicLocale('en')).toBe(false)
    expect(isArabicLocale('en-US')).toBe(false)
  })

  it('picks the name matching the interface language', () => {
    expect(souqDisplayName(category, 'en')).toBe('Cars')
    expect(souqDisplayName(category, 'en-US')).toBe('Cars')
    expect(souqDisplayName(category, 'ar')).toBe('سيارات')
    expect(souqDisplayName(category, 'ar-EG')).toBe('سيارات')
  })

  it('falls back to the other language, then to the code', () => {
    expect(souqDisplayName({ code: 'cars', nameEn: 'Cars', nameAr: null }, 'ar')).toBe('Cars')
    expect(souqDisplayName({ code: 'cars', nameEn: null, nameAr: 'سيارات' }, 'en')).toBe('سيارات')
    expect(souqDisplayName({ code: 'cars', nameEn: '', nameAr: '' }, 'en')).toBe('cars')
    expect(souqDisplayName(null, 'en')).toBeUndefined()
  })

  it('labels a category with a path fallback', () => {
    expect(souqCategoryLabel(category, 'en')).toBe('Cars')
    expect(souqCategoryLabel({ code: 'cars', nameEn: '', nameAr: '', path: ['vehicles', 'cars'] }, 'en')).toBe('cars')
    expect(souqCategoryLabel(null, 'en')).toBeUndefined()
  })

  it('labels a location', () => {
    expect(souqLocationLabel(location, 'en')).toBe('Doha')
    expect(souqLocationLabel(location, 'ar')).toBe('الدوحة')
    expect(souqLocationLabel(null, 'en')).toBeUndefined()
  })

  it('formats a decimal amount with its currency', () => {
    expect(formatSouqAmount('145000.00', 'QAR', 'en-US')).toContain('145,000')
    expect(formatSouqAmount('145000.00', 'QAR', 'en-US')).toContain('QAR')
    expect(formatSouqAmount('145000.00', 'QAR', 'ar-EG')).toContain('١٤٥')
  })

  it('falls back to a plain string on invalid input', () => {
    expect(formatSouqAmount('abc', 'QAR', 'en-US')).toBe('abc QAR')
    // 'QAR1' is not a valid ISO 4217 code: Intl throws and the fallback is used.
    expect(formatSouqAmount('145000.00', 'QAR1', 'en-US')).toBe('145000.00 QAR1')
  })
})

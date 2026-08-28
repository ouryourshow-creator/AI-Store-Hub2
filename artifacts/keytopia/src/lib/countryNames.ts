const unknownCountryNames = {
  en: 'Unknown',
  ar: 'غير معروف',
} as const;

/**
 * Converts an ISO 3166-1 alpha-2 country code to a readable name.
 * Analytics stores country codes so they remain compact and language-neutral.
 */
export function getCountryName(countryCode: string, dir: 'rtl' | 'ltr'): string {
  const normalizedCode = countryCode.trim().toUpperCase();
  if (!normalizedCode || normalizedCode === 'UNKNOWN') {
    return unknownCountryNames[dir === 'rtl' ? 'ar' : 'en'];
  }

  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    return countryCode;
  }

  try {
    const locale = dir === 'rtl' ? 'ar' : 'en';
    return new Intl.DisplayNames([locale], { type: 'region' }).of(normalizedCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}
const cachedCountryKey = 'keytopia_visitor_country_v3';
const timezoneCountryHints: Record<string, string> = {
  'Africa/Cairo': 'EG',
  'Africa/Casablanca': 'MA',
  'Africa/Johannesburg': 'ZA',
  'Asia/Amman': 'JO',
  'Asia/Beirut': 'LB',
  'Asia/Bahrain': 'BH',
  'Asia/Dubai': 'AE',
  'Asia/Kuwait': 'KW',
  'Asia/Qatar': 'QA',
  'Asia/Riyadh': 'SA',
};

function validCountryCode(value: string | null | undefined): string | null {
  const countryCode = value?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(countryCode) ? countryCode : null;
}

/**
 * Gets the visitor's country when the hosting proxy does not expose it to the
 * API server. The result is cached so navigation does not repeatedly call the
 * lookup service.
 */
export function getVisitorCountryCode(): Promise<string | null> {
  const cached = validCountryCode(localStorage.getItem(cachedCountryKey));
  if (cached) return Promise.resolve(cached);

  const localeCountry = (navigator.languages ?? [navigator.language])
    .map((locale) => locale.match(/[-_]([A-Z]{2})$/i)?.[1])
    .map(validCountryCode)
    .find((countryCode): countryCode is string => Boolean(countryCode));
  const timezoneCountry = timezoneCountryHints[Intl.DateTimeFormat().resolvedOptions().timeZone];
  // Time zones are a stronger local signal than browser language. For example,
  // many visitors in Egypt use an English browser with an en-US locale while
  // their device time zone remains Africa/Cairo.
  const countryCode = timezoneCountry ?? localeCountry ?? null;
  if (countryCode) localStorage.setItem(cachedCountryKey, countryCode);
  return Promise.resolve(countryCode);
}
const cachedCountryKey = 'keytopia_visitor_country';
let countryPromise: Promise<string | null> | null = null;

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
  if (countryPromise) return countryPromise;

  countryPromise = fetch('https://ipapi.co/country/', {
    cache: 'force-cache',
    signal: AbortSignal.timeout(1800),
  })
    .then((response) => response.ok ? response.text() : '')
    .then((value) => {
      const countryCode = validCountryCode(value);
      if (countryCode) localStorage.setItem(cachedCountryKey, countryCode);
      return countryCode;
    })
    .catch(() => null);

  return countryPromise;
}
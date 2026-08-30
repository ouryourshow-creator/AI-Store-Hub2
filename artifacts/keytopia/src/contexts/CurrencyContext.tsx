import { createContext, useContext, useRef, useState, type ReactNode } from 'react';

export type StoreCurrency = 'EGP' | 'USD';
const currencyPreferenceKey = 'keytopia_currency_preference';

function readCurrencyPreference(): StoreCurrency | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(currencyPreferenceKey);
  return stored === 'EGP' || stored === 'USD' ? stored : null;
}

const CurrencyContext = createContext<{
  currency: StoreCurrency;
  setCurrency: (currency: StoreCurrency) => void;
  setDetectedCurrency: (currency: StoreCurrency) => void;
} | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const storedPreference = readCurrencyPreference();
  const [currency, setCurrencyState] = useState<StoreCurrency>(storedPreference ?? 'EGP');
  const hasManualPreferenceRef = useRef(storedPreference !== null);

  const setCurrency = (nextCurrency: StoreCurrency) => {
    hasManualPreferenceRef.current = true;
    setCurrencyState(nextCurrency);
    window.localStorage.setItem(currencyPreferenceKey, nextCurrency);
  };

  const setDetectedCurrency = (detectedCurrency: StoreCurrency) => {
    if (!hasManualPreferenceRef.current) setCurrencyState(detectedCurrency);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, setDetectedCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider');
  return context;
}
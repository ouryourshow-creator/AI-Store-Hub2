import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { Product } from '@workspace/api-client-react';
import { listProducts, saveCartAbandonment, recoverCartAbandonment } from '@workspace/api-client-react';
import { useCurrency } from './CurrencyContext';

export type CartItem = Product & {
  quantity: number;
  selectedDuration: string;
  selectedPrice: number;
  selectedCurrency: 'EGP' | 'USD';
};

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, selectedDuration: string, selectedPrice: number, selectedCurrency: 'EGP' | 'USD') => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  revalidateCart: () => Promise<number>;
  isRevalidating: boolean;
  priceChangedCount: number;
  clearPriceChangedCount: () => void;
  cartId: string;
  markCartRecovered: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function migrateCartItems(raw: unknown[]): CartItem[] {
  return raw.map((item: any) => ({
    ...item,
    selectedDuration: item.selectedDuration ?? item.duration ?? '',
    selectedPrice: item.selectedPrice ?? item.salePrice ?? item.price ?? 0,
    selectedCurrency: item.selectedCurrency === 'USD' ? 'USD' : 'EGP',
  }));
}

/** Resolve the correct current price for a cart item against a live product. */
function resolveCurrentPrice(liveProduct: Product, selectedDuration: string, currency: 'EGP' | 'USD'): number {
  if (liveProduct.pricingOptions && liveProduct.pricingOptions.length > 0) {
    const match = liveProduct.pricingOptions.find(opt => opt.duration === selectedDuration);
    if (match) {
      if (currency === 'USD' && (match.salePriceUsd ?? match.priceUsd) != null) {
        return match.salePriceUsd ?? match.priceUsd!;
      }
      return match.salePrice != null ? match.salePrice : match.price;
    }
  }
  if (currency === 'USD' && (liveProduct.salePriceUsd ?? liveProduct.priceUsd) != null) {
    return liveProduct.salePriceUsd ?? liveProduct.priceUsd!;
  }
  return liveProduct.salePrice != null ? liveProduct.salePrice : liveProduct.price;
}

function resolveCurrentSelection(
  liveProduct: Product,
  selectedDuration: string,
  requestedCurrency: 'EGP' | 'USD',
): { price: number; currency: 'EGP' | 'USD' } {
  if (liveProduct.pricingOptions && liveProduct.pricingOptions.length > 0) {
    const match = liveProduct.pricingOptions.find(opt => opt.duration === selectedDuration);
    if (match && requestedCurrency === 'USD' && (match.salePriceUsd ?? match.priceUsd) != null) {
      return {
        price: match.salePriceUsd ?? match.priceUsd!,
        currency: 'USD',
      };
    }
    if (match) {
      return {
        price: match.salePrice != null ? match.salePrice : match.price,
        currency: 'EGP',
      };
    }
  }

  if (requestedCurrency === 'USD' && (liveProduct.salePriceUsd ?? liveProduct.priceUsd) != null) {
    return {
      price: liveProduct.salePriceUsd ?? liveProduct.priceUsd!,
      currency: 'USD',
    };
  }

  return {
    price: liveProduct.salePrice != null ? liveProduct.salePrice : liveProduct.price,
    currency: 'EGP',
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { currency } = useCurrency();
  const [cartId] = useState(() => {
    try {
      const stored = localStorage.getItem('keytopia_cart_id');
      if (stored && /^[a-zA-Z0-9_-]{12,100}$/.test(stored)) return stored;
      const next = crypto.randomUUID();
      localStorage.setItem('keytopia_cart_id', next);
      return next;
    } catch {
      return `cart_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  });
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('keytopia_cart');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? migrateCartItems(parsed) : [];
    } catch {
      return [];
    }
  });

  const [priceChangedCount, setPriceChangedCount] = useState(0);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const previousCurrencyRef = useRef<'EGP' | 'USD' | null>(null);
  const cartTotal = items.reduce((sum, item) => sum + (item.selectedPrice * item.quantity), 0);
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Mirror items into a ref so revalidateCart can check emptiness without
  // capturing state in a closure (avoids the pre-await snapshot problem).
  const itemsRef = useRef<CartItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Monotonically increasing counter: the latest revalidation always wins;
  // any response from an earlier concurrent call is discarded.
  const revalidationSeqRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('keytopia_cart', JSON.stringify(items));
  }, [items]);

  // Keep a lightweight server-side snapshot so admins can follow up on carts
  // that have been inactive for at least an hour. The debounce avoids a request
  // for every quantity click while preserving the latest cart contents.
  useEffect(() => {
    if (items.length === 0) return;
    const timer = window.setTimeout(() => {
      void saveCartAbandonment({
        cartId,
        currency: items[0].selectedCurrency,
        subtotal: Math.round(cartTotal * 100) / 100,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        items: items.map((item) => ({
          productId: item.id,
          productName: item.name,
          duration: item.selectedDuration,
          quantity: item.quantity,
          unitPrice: item.selectedPrice,
        })),
      }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [cartId, cartTotal, items]);

  // Keep an existing cart aligned with the currency selected in the header.
  useEffect(() => {
    if (previousCurrencyRef.current === currency) return;
    previousCurrencyRef.current = currency;
    setItems(current => current.map(item => {
      const selection = resolveCurrentSelection(item, item.selectedDuration, currency);
      return {
        ...item,
        selectedPrice: selection.price,
        selectedCurrency: selection.currency,
      };
    }));
  }, [currency]);

  /**
   * Fetch live product data and silently patch any stale selectedPrice values.
   *
   * Concurrency-safe design:
   * - Uses a sequence counter so only the most recent call's response is applied.
   * - Applies changes through a functional setItems(current => …) so any cart
   *   mutations that occurred while the request was in-flight (adds, removes,
   *   quantity changes) are fully preserved — we never replace the whole cart
   *   from a pre-await snapshot.
   *
   * Returns the number of items whose price was updated.
   */
  const revalidateCart = useCallback(async (): Promise<number> => {
    // Claim a sequence slot up-front.
    const seq = ++revalidationSeqRef.current;

    // Use the ref for the early-exit check — safe to read synchronously here
    // because we haven't awaited anything yet.
    if (itemsRef.current.length === 0) return 0;

    setIsRevalidating(true);
    try {
      const liveProducts = await listProducts();

      // If a newer revalidation started while we were fetching, silently discard
      // this response. Do NOT clear isRevalidating — the active request is still running.
      if (seq !== revalidationSeqRef.current) return 0;

      const liveMap = new Map(liveProducts.map(p => [p.id, p]));

      // Build a patch map: product id → corrected price + refreshed product fields.
      // We compare against itemsRef.current (the post-await snapshot) only to count
      // how many prices changed for the user-visible notice.
      let changedCount = 0;
      const patchMap = new Map<number, { correctedPrice: number; live: Product }>();

      for (const item of itemsRef.current) {
        const live = liveMap.get(item.id);
        if (!live) continue;
        const correctedPrice = resolveCurrentPrice(live, item.selectedDuration, item.selectedCurrency);
        if (correctedPrice !== item.selectedPrice) changedCount++;
        patchMap.set(item.id, { correctedPrice, live });
      }

      // Apply patches through a functional updater so mutations that happened
      // during the fetch (adds, removes, quantity tweaks) are never lost.
      setItems(current => {
        if (current.length === 0) return current;
        return current.map(item => {
          const patch = patchMap.get(item.id);
          if (!patch) return item;
          // Preserve customer-controlled fields; overwrite price + product metadata.
          return {
            ...item,
            ...patch.live,
            selectedDuration: item.selectedDuration,
            selectedPrice: patch.correctedPrice,
            quantity: item.quantity,
          };
        });
      });

      if (changedCount > 0) {
        setPriceChangedCount(changedCount);
      }

      // Only the active (latest) request may release the checkout gate.
      setIsRevalidating(false);
      return changedCount;
    } catch {
      // Network error — leave cart as-is. Only clear the gate if this is still
      // the latest request; a newer in-flight request must keep it locked.
      if (seq === revalidationSeqRef.current) {
        setIsRevalidating(false);
      }
      return 0;
    }
  }, []);

  const clearPriceChangedCount = useCallback(() => setPriceChangedCount(0), []);

  // Revalidate on initial app load.
  useEffect(() => {
    revalidateCart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = (product: Product, selectedDuration: string, selectedPrice: number, selectedCurrency: 'EGP' | 'USD') => {
    setItems((current) => {
      if (current.length && current[0].selectedCurrency !== selectedCurrency) {
        return current;
      }
      const existing = current.find(item => item.id === product.id);
      if (existing) {
        return current.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, selectedDuration, selectedPrice, selectedCurrency }
            : item
        );
      }
      return [...current, { ...product, quantity: 1, selectedDuration, selectedPrice, selectedCurrency }];
    });
  };

  const removeItem = (productId: number) => {
    setItems(current => current.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems(current =>
      current.map(item => item.id === productId ? { ...item, quantity } : item)
    );
  };

  const clearCart = () => setItems([]);

  const markCartRecovered = useCallback(async () => {
    try {
      await recoverCartAbandonment(cartId);
    } catch {
      // Order creation is authoritative; a failed cleanup must not block it.
    }
  }, [cartId]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        cartTotal,
        cartCount,
        revalidateCart,
        isRevalidating,
        priceChangedCount,
        clearPriceChangedCount,
        cartId,
        markCartRecovered,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

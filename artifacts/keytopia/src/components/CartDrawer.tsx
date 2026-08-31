import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Trash2, RefreshCw } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useLang } from '../contexts/LanguageContext';
import { useUser } from '@clerk/react';
import { useEffect } from 'react';
import { useLocation } from 'wouter';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const {
    items,
    updateQuantity,
    removeItem,
    cartTotal,
    revalidateCart,
    isRevalidating,
    priceChangedCount,
    clearPriceChangedCount,
  } = useCart();
  const { t, dir } = useLang();
  const { isLoaded, isSignedIn } = useUser();
  const [, setLocation] = useLocation();

  // In RTL, drawer slides from left; in LTR from right
  const slideX = dir === 'rtl' ? '-100%' : '100%';
  const drawerSide = dir === 'rtl' ? 'left-0 border-r' : 'right-0 border-l';

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Revalidate prices each time the drawer opens.
  useEffect(() => {
    if (!isOpen) return;
    if (items.length === 0) return;
    revalidateCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            />

            <motion.div
              initial={{ x: slideX }}
              animate={{ x: 0 }}
              exit={{ x: slideX }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`fixed inset-y-0 ${drawerSide} w-full max-w-md bg-card shadow-2xl z-50 flex flex-col border-black/[0.03]`}
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              dir={dir}
            >
              <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-5 border-b border-black/[0.03]">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-display font-bold">{t('yourCart')}</h2>
                  {isRevalidating && (
                    <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                  )}
                </div>
                <button
                  onClick={onClose}
                  aria-label={dir === 'rtl' ? 'إغلاق السلة' : 'Close cart'}
                  className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Price-changed notice */}
              <AnimatePresence>
                {priceChangedCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 px-6 py-3 bg-amber-50 border-b border-amber-100 text-amber-800 text-xs">
                      <span>{t('priceUpdated')}</span>
                      <button
                        onClick={clearPriceChangedCount}
                        className="flex-shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
                        aria-label="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4 md:gap-6">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <X className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="font-medium">{t('cartEmpty')}</p>
                    <p className="text-sm mt-1">{t('cartEmptySub')}</p>
                  </div>
                ) : (
                  items.map(item => (
                    <div key={item.id} className="flex gap-3 rounded-xl border border-black/[0.05] bg-white p-3 md:border-0 md:p-0">
                      <div className="w-18 h-18 md:w-20 md:h-20 rounded-[10px] md:rounded-[12px] overflow-hidden bg-muted flex-shrink-0">
                        {item.coverImageUrl ? (
                          <img src={item.coverImageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                            <span className="text-white/30 font-display font-bold">{item.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col flex-1 justify-between py-1">
                        <div>
                          <h3 className="font-display font-semibold text-sm leading-tight mb-1">{item.name}</h3>
                          <span className="text-[10px] font-medium text-accent-foreground px-2 py-0.5 rounded-full bg-accent/20">
                            {item.selectedDuration}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="font-display font-bold text-sm">{item.selectedCurrency ?? 'EGP'} {item.selectedPrice}</span>

                          <div className="flex items-center gap-1 bg-muted rounded-xl p-0.5">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              aria-label={item.quantity <= 1 ? (dir === 'rtl' ? 'حذف المنتج' : 'Remove item') : (dir === 'rtl' ? 'تقليل الكمية' : 'Decrease quantity')}
                              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-background text-foreground transition-colors"
                            >
                              {item.quantity <= 1 ? <Trash2 className="w-3 h-3 text-destructive" /> : <Minus className="w-3 h-3" />}
                            </button>
                            <span className="text-xs font-semibold w-3 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              aria-label={dir === 'rtl' ? 'زيادة الكمية' : 'Increase quantity'}
                              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-background text-foreground transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {items.length > 0 && (
                <div className="p-4 md:p-6 border-t border-black/[0.03] bg-background">
                  <div className="flex justify-between mb-4 font-display">
                    <span className="text-muted-foreground">{t('total')}</span>
                    <span className="font-bold text-xl">{items[0]?.selectedCurrency ?? 'EGP'} {cartTotal}</span>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      // Ask signed-out customers to authenticate before entering
                      // checkout. The cart is kept in context, and sign-in
                      // redirects back to checkout after authentication.
                      setLocation(isLoaded && !isSignedIn ? '/sign-in' : '/checkout');
                    }}
                    disabled={isRevalidating}
                    className="min-h-12 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 rounded-xl md:rounded-[20px] transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    {isRevalidating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {t('checkingPrices')}
                      </>
                    ) : (
                      t('proceedToOrder')
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </>
  );
}

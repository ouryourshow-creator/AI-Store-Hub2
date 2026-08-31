import { Product } from '@workspace/api-client-react';
import { useCart } from '../contexts/CartContext';
import { useLang } from '../contexts/LanguageContext';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { Gift, TrendingUp } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import {
  formatProductTag,
  getAvailabilityBadgeClass,
  getProductBadgeClass,
  productTagBaseClass,
} from '../lib/productBadges';

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { t, lang } = useLang();
  const { currency } = useCurrency();
  const priceForOption = (option: NonNullable<Product['pricingOptions']>[number]) => {
    const usd = option.salePriceUsd ?? option.priceUsd;
    return usd != null ? { amount: currency === 'USD' ? usd : option.salePrice ?? option.price, code: currency === 'USD' ? 'USD' as const : 'EGP' as const, original: currency === 'USD' && option.salePriceUsd != null ? option.priceUsd : currency === 'EGP' && option.salePrice != null ? option.price : null }
      : { amount: option.salePrice ?? option.price, code: 'EGP' as const, original: option.salePrice != null ? option.price : null };
  };
  const priceForProduct = () => {
    const usd = product.salePriceUsd ?? product.priceUsd;
    return usd != null ? { amount: currency === 'USD' ? usd : product.salePrice ?? product.price, code: currency === 'USD' ? 'USD' as const : 'EGP' as const, original: currency === 'USD' && product.salePriceUsd != null ? product.priceUsd : currency === 'EGP' && product.salePrice != null ? product.price : null }
      : { amount: product.salePrice ?? product.price, code: 'EGP' as const, original: product.salePrice != null ? product.price : null };
  };

  // Determine the cheapest pricing option (if multiple exist)
  const hasMultipleOptions =
    product.pricingOptions != null && product.pricingOptions.length > 1;

  const cheapestOption = hasMultipleOptions
    ? [...product.pricingOptions!].sort((a, b) => {
        const aEffective = priceForOption(a).amount;
        const bEffective = priceForOption(b).amount;
        return aEffective - bEffective;
      })[0]
    : null;

  // What to show in the duration badge
  const badgeDuration = cheapestOption ? cheapestOption.duration : product.duration;

  // What to show as the price
  const display = cheapestOption ? priceForOption(cheapestOption) : priceForProduct();
  const discountPercent = display.original != null && display.original > display.amount
    ? Math.round(((display.original - display.amount) / display.original) * 100)
    : null;
  const cashback = Math.round(display.amount * 0.05 * 100) / 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="bg-card rounded-[14px] md:rounded-[20px] overflow-hidden border border-black/[0.06] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
    >
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {product.coverImageUrl ? (
            <img
              src={product.coverImageUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-primary opacity-90 flex items-center justify-center">
              <span className="text-white/30 font-display font-bold text-2xl md:text-4xl">{product.name.charAt(0)}</span>
            </div>
          )}
          <div className="absolute top-2 end-2 md:top-4 md:end-4 bg-accent/20 backdrop-blur-md text-secondary font-semibold text-[10px] md:text-xs px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-accent/30">
            {badgeDuration}
          </div>
          <div className="absolute bottom-2 start-2 flex max-w-[92%] flex-wrap gap-1.5">
            <span className={`${productTagBaseClass} ${getAvailabilityBadgeClass(product.availability)}`}>
              {formatProductTag(product.availability)}
            </span>
            {product.badges.slice(0, 2).map((badge) => (
              <span key={badge} className={`${productTagBaseClass} ${getProductBadgeClass(badge)}`}>
                {formatProductTag(badge)}
              </span>
            ))}
          </div>
        </div>
      </Link>

      <div className="p-4 md:p-6 flex flex-col flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-[#1CC88A] bg-[#1CC88A]/10">
            <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-[#1CC88A] animate-pulse" />
            {t('instantActivation')}
          </span>
          {typeof product.soldCount === 'number' && product.soldCount > 0 && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200">
              <TrendingUp className="w-2.5 h-2.5" />
              {lang === 'ar'
                ? `${product.soldCount.toLocaleString('ar-EG')}+ عدد مرات البيع`
                : `${product.soldCount.toLocaleString()}+ sold`}
            </span>
          )}
        </div>

        <Link href={`/products/${product.slug}`}>
          <h3 className="text-base md:text-xl font-display font-bold mt-1.5 md:mt-2 mb-0.5 md:mb-1 text-foreground hover:text-primary transition-colors line-clamp-2">{product.name}</h3>
        </Link>

        {product.description && (
          <p className="hidden md:block text-sm text-muted-foreground line-clamp-2 mb-4">{product.description}</p>
        )}

        <div className="mt-auto pt-2 md:pt-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="hidden md:block text-[10px] text-muted-foreground uppercase tracking-widest font-medium">{t('price')}</span>
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="font-display font-bold text-base md:text-xl text-foreground">
                {hasMultipleOptions ? `${t('from')} ` : ''}{display.code} {display.amount}
              </span>
              {display.original != null && (
                <span className="text-xs md:text-sm text-muted-foreground line-through">
                  {display.code} {display.original}
                </span>
              )}
              {discountPercent != null && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">{discountPercent}% OFF</span>}
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <Gift className="h-3.5 w-3.5" />
          <span>{lang === 'ar' ? `هتكسب ${cashback} ${display.code === 'EGP' ? 'جنيه' : 'دولار'} كاش باك` : `Earn ${display.code} ${cashback} cashback`}</span>
        </div>

        <button
          onClick={() => {
            const addDuration = cheapestOption ? cheapestOption.duration : product.duration;
            addItem(product, addDuration, display.amount, display.code);
            toast.success(t('addToCart'), {
              description: product.name,
              duration: 2000,
            });
          }}
          disabled={product.availability === 'out_of_stock' || product.availability === 'coming_soon'}
          className="mt-3 md:mt-5 min-h-11 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 rounded-xl md:rounded-full text-sm md:text-base transition-all active:scale-[0.98] shadow-sm hover:shadow active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('addToCart')}
        </button>
      </div>
    </motion.div>
  );
}

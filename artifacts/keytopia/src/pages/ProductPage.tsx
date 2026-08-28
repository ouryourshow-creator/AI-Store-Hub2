import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { getGetProductBySlugQueryKey, getGetProductQueryKey, useGetProduct, useGetProductBySlug, useListProducts, useRecordVisit } from '@workspace/api-client-react';
import { useCart } from '../contexts/CartContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useLang } from '../contexts/LanguageContext';
import { getVisitorCountryCode } from '../lib/visitorCountry';
import {
  formatProductTag,
  getAvailabilityBadgeClass,
  getProductBadgeClass,
  productTagBaseClass,
} from '../lib/productBadges';
import { calculateCashback } from '../lib/cashback';
import Layout from '../components/Layout';
import { ArrowRight, ArrowLeft, ShieldCheck, Zap, Clock, MessageCircle, CheckCircle2, Tag, Info, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ProductCard from '../components/ProductCard';

const CUSTOMER_INFO_LABELS: Record<string, { ar: string; en: string }> = {
  email:       { ar: 'البريد الإلكتروني', en: 'Email' },
  password:    { ar: 'كلمة المرور', en: 'Password' },
  username:    { ar: 'اسم المستخدم', en: 'Username' },
  inviteEmail: { ar: 'بريد الدعوة', en: 'Invite Email' },
  notes:       { ar: 'ملاحظات', en: 'Notes' },
};

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const legacyId = Number(slug);
  const isLegacyUrl = /^\d+$/.test(slug);
  const { t, dir, lang } = useLang();
  const { addItem } = useCart();
  const { currency, setCurrency } = useCurrency();
  const [location] = useLocation();
  const legacyQuery = useGetProduct(legacyId, {
    query: { enabled: isLegacyUrl, queryKey: getGetProductQueryKey(legacyId) },
  });
  const slugQuery = useGetProductBySlug(slug, {
    query: { enabled: !isLegacyUrl, queryKey: getGetProductBySlugQueryKey(slug) },
  });
  const product = isLegacyUrl ? legacyQuery.data : slugQuery.data;
  const isLoading = isLegacyUrl ? legacyQuery.isLoading : slugQuery.isLoading;
  const isError = isLegacyUrl ? legacyQuery.isError : slugQuery.isError;
  const recordVisit = useRecordVisit();
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(0);
  const { data: allProducts } = useListProducts();

  useEffect(() => {
    const fallbackTitle = 'Keytopia Store';
    const fallbackDescription = 'اشترك في أشهر برامج الذكاء الاصطناعي، بأرخص الأسعار.';
    const title = product ? `${product.name} | Keytopia` : fallbackTitle;
    const description = product?.description?.trim() || fallbackDescription;
    const image = product?.coverImageUrl
      ? new URL(product.coverImageUrl, window.location.origin).toString()
      : `${window.location.origin}/logo.png`;
    const url = `${window.location.origin}${location}`;

    document.title = title;
    const setMeta = (selector: string, attribute: 'name' | 'property', value: string) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, selector.split('=')[1].replace(/["\]]/g, ''));
        document.head.appendChild(element);
      }
      element.content = value;
    };
    setMeta('meta[name="description"]', 'name', description);
    setMeta('meta[property="og:title"]', 'property', title);
    setMeta('meta[property="og:description"]', 'property', description);
    setMeta('meta[property="og:image"]', 'property', image);
    setMeta('meta[property="og:url"]', 'property', url);
    setMeta('meta[name="twitter:title"]', 'name', title);
    setMeta('meta[name="twitter:description"]', 'name', description);
    setMeta('meta[name="twitter:image"]', 'name', image);
  }, [location, product]);

  useEffect(() => {
    if (!product) return;
    const key = 'keytopia_visitor';
    const visitorId = localStorage.getItem(key) ?? crypto.randomUUID();
    localStorage.setItem(key, visitorId);
    let cancelled = false;
    void getVisitorCountryCode().then((countryCode) => {
      if (cancelled) return;
      recordVisit.mutate({
        data: { path: location, productId: product.id, visitorId, countryCode },
      }, {
        onSuccess: (result) => setCurrency(result.currency),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [location, product?.id]);

  const BackArrow = dir === 'rtl' ? ArrowRight : ArrowLeft;

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-6 py-24 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (isError || !product) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">
          <h1 className="text-2xl font-display font-bold mb-2">{t('productNotFound')}</h1>
          <p className="text-muted-foreground mb-8">{t('productNotFoundSub')}</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-full">
            <BackArrow className="w-4 h-4" />
            {t('backToStore')}
          </Link>
        </div>
      </Layout>
    );
  }

  const pricingOptions = product.pricingOptions && product.pricingOptions.length > 0
    ? product.pricingOptions
    : [{ duration: product.duration, price: product.price, salePrice: product.salePrice }];
  const selectedOption = pricingOptions[selectedOptionIdx] ?? pricingOptions[0];
  const selectedUsdPrice = selectedOption.salePriceUsd ?? selectedOption.priceUsd;
  const selectedCurrency = currency === 'USD' && selectedUsdPrice != null ? 'USD' : 'EGP';
  const selectedPrice = selectedCurrency === 'USD' ? selectedUsdPrice! : selectedOption.salePrice ?? selectedOption.price;
  const cashbackToEarn = calculateCashback(selectedPrice);

  const handleAddToCart = () => {
    addItem(product, selectedOption.duration, selectedPrice, selectedCurrency);
    toast.success(t('addToCart'), { description: product.name, duration: 2000 });
  };

  const infoCards = [
    {
      icon: Zap,
      label: t('activationTime'),
      value: product.deliveryTime ?? t('activationTimeDetail'),
    },
    {
      icon: ShieldCheck,
      label: t('warranty'),
      value: product.warrantyDuration
        ? (dir === 'rtl' ? `ضمان لمدة ${product.warrantyDuration}` : `${product.warrantyDuration} warranty`)
        : t('warrantyDetail'),
    },
    {
      icon: Clock,
      label: t('subscriptionDuration'),
      value: selectedOption.duration,
    },
    {
      icon: MessageCircle,
      label: t('support'),
      value: t('supportDetail'),
    },
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-10 w-full">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
        >
          <BackArrow className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          {t('backToStore')}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left — image */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-[24px] overflow-hidden aspect-square bg-muted shadow-sm border border-black/[0.06]"
          >
            {product.coverImageUrl ? (
              <img src={product.coverImageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                <span className="text-white/20 font-display font-bold text-8xl">{product.name.charAt(0)}</span>
              </div>
            )}
          </motion.div>

          {/* Right — details */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="flex flex-col gap-5"
          >
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${productTagBaseClass} px-3 py-1.5 text-xs ${getAvailabilityBadgeClass(product.availability)}`}>
                {formatProductTag(product.availability)}
              </span>
              {product.badges.map((badge) => (
                <span key={badge} className={`${productTagBaseClass} px-3 py-1.5 text-xs ${getProductBadgeClass(badge)}`}>
                  {formatProductTag(badge)}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-[#1CC88A] bg-[#1CC88A]/10 border border-[#1CC88A]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1CC88A] animate-pulse" />
                {t('instantActivation')}
              </span>
              {typeof product.soldCount === 'number' && product.soldCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200">
                  <TrendingUp className="w-3 h-3" />
                  {dir === 'rtl'
                    ? `${product.soldCount.toLocaleString('ar-EG')}+ عدد مرات البيع`
                    : `${product.soldCount.toLocaleString()}+ sold`}
                </span>
              )}
              {product.category && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20">
                  <Tag className="w-3 h-3" />
                  {product.category}
                </span>
              )}
              {product.activationType && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-muted-foreground bg-muted border border-black/[0.06]">
                  {product.activationType}
                </span>
              )}
            </div>

            {/* Name + brand */}
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground leading-snug">
                {product.name}
              </h1>
              {product.brand && (
                <p className="mt-1 text-sm text-muted-foreground font-medium">{product.brand}</p>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-muted-foreground leading-relaxed text-base">
                {product.description}
              </p>
            )}

            {/* Features checklist */}
            {product.features && product.features.length > 0 && (
              <div className="bg-muted/50 rounded-[16px] border border-black/[0.05] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  {t('whatsIncluded')}
                </p>
                <ul className="flex flex-col gap-2">
                  {product.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                      <CheckCircle2 className="w-4 h-4 text-[#1CC88A] mt-0.5 flex-shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Price + CTA card */}
            <div className="bg-card rounded-[20px] border border-black/[0.06] p-6 flex flex-col gap-4 shadow-sm">
              {/* Duration selector */}
              {pricingOptions.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {pricingOptions.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedOptionIdx(i)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                        i === selectedOptionIdx
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-muted text-muted-foreground border-transparent hover:border-primary/30'
                      }`}
                    >
                      {opt.duration}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium block mb-1">
                    {t('price')}
                  </span>
                  {selectedCurrency === 'USD' ? (
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-display font-bold text-foreground">
                        USD {selectedPrice}
                      </span>
                      {selectedOption.salePriceUsd != null && selectedOption.priceUsd != null && (
                        <span className="text-lg text-muted-foreground line-through">
                          USD {selectedOption.priceUsd}
                        </span>
                      )}
                    </div>
                  ) : selectedOption.salePrice != null ? (
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-display font-bold text-foreground">
                        EGP {selectedPrice}
                      </span>
                      <span className="text-lg text-muted-foreground line-through">
                        EGP {selectedOption.price}
                      </span>
                    </div>
                  ) : (
                    <span className="text-4xl font-display font-bold text-foreground">
                      EGP {selectedPrice}
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                <span className="font-display font-bold">
                  {selectedCurrency} {cashbackToEarn.toFixed(2)}
                </span>{' '}
                {t('cashbackOnProduct')}
              </div>
              <button
                onClick={handleAddToCart}
                disabled={product.availability === 'out_of_stock' || product.availability === 'coming_soon'}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-4 rounded-[16px] transition-all active:scale-[0.98] shadow-sm text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('addToCart')}
              </button>
              <a
                href={`https://wa.me/201229327902?text=${encodeURIComponent(
                  lang === 'ar'
                    ? `مرحباً، أريد الاستفسار عن ${product.name}`
                    : `Hello, I'd like to ask about ${product.name}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 border border-[#25D366] text-[#25D366] hover:bg-[#25D366]/5 font-semibold py-3.5 rounded-[16px] transition-all text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                {t('contactViaWhatsApp')}
              </a>
            </div>

            {/* Customer info required */}
            {product.customerInfoRequired && product.customerInfoRequired.length > 0 && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-[14px] p-4">
                <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1.5">
                    {t('customerInfoRequiredLabel')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.customerInfoRequired.map((key) => {
                      const label = CUSTOMER_INFO_LABELS[key];
                      return (
                        <span key={key} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          {label ? (lang === 'ar' ? label.ar : label.en) : key}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Info cards grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {infoCards.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-card rounded-[20px] border border-black/[0.06] p-6 flex gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                <p className="text-sm text-foreground leading-relaxed">{value}</p>
              </div>
            </div>
          ))}
        </motion.div>
        {allProducts && allProducts.filter((candidate) => candidate.id !== product.id).length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-display font-bold mb-6">{dir === 'rtl' ? 'قد يعجبك أيضاً' : 'You might also like'}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {allProducts.filter((candidate) => candidate.id !== product.id).sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category)).slice(0, 3).map((candidate) => <ProductCard key={candidate.id} product={candidate} />)}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}

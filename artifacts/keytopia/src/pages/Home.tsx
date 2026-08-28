import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useListProducts, useListCategories, type Product } from '@workspace/api-client-react';
import Layout from '../components/Layout';
import ProductCard from '../components/ProductCard';
import { Search, CheckCircle2, Zap, ShieldCheck, Clock, Shield, Star, Facebook, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '../contexts/LanguageContext';
import { Link } from 'wouter';
import {
  formatProductTag,
  getAvailabilityBadgeClass,
  getProductBadgeClass,
  productTagBaseClass,
} from '../lib/productBadges';

const REVIEWS = [
  {
    name: 'Mahmoud Ahmed Hussein',
    initials: 'M',
    date: 'مايو ٢٠٢٥',
    dateEn: 'May 2025',
    text: 'تم التفعيل بنجاح، برو لمدة سنة ، تسلم ايديكم',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    name: 'Alaa Saadeh',
    initials: 'A',
    date: 'يونيو ٢٠٢٥',
    dateEn: 'June 2025',
    text: 'التواصل سريع وكذلك الخدمة\nاشتركت لمدة سنة كما هو مذكور\nأنصح بالتعامل مع الصفحة',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    name: 'Adel Omar',
    initials: 'A',
    date: 'أغسطس ٢٠٢٥',
    dateEn: 'August 2025',
    text: 'اشتركت معاهم و تم التفعيل بسرعة\nانصح بالتعامل مع الصفحة',
    color: 'from-orange-500 to-rose-500',
  },
  {
    name: 'Abeer Elshenawy',
    initials: 'A',
    date: 'أكتوبر ٢٠٢٥',
    dateEn: 'October 2025',
    text: 'اتوقع ليكم مزيد من النجاح',
    color: 'from-purple-500 to-pink-500',
  },
  {
    name: 'Hesham Abdelhameed',
    initials: 'H',
    date: 'أكتوبر ٢٠٢٥',
    dateEn: 'October 2025',
    text: 'ناس محترمين وسرعة في الرد والاستجابة',
    color: 'from-slate-600 to-slate-800',
  },
];

interface ManagedReview {
  id: number;
  reviewerName: string;
  reviewDate: string;
  content: string;
}

const MARQUEE_CARD_WIDTH = 200;
const MARQUEE_GAP = 16;
const MARQUEE_SPEED_PX_PER_SECOND = 32;

function ProductMarquee({ products, lang }: { products: Product[]; lang: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const sequenceWidthRef = useRef(0);
  const pausedRef = useRef(false);
  const interactingRef = useRef(false);
  const resumeTimeoutRef = useRef<number | null>(null);
  const [copiesPerSequence, setCopiesPerSequence] = useState(() => {
    const minimumItems = Math.ceil((window.innerWidth + MARQUEE_CARD_WIDTH) / (MARQUEE_CARD_WIDTH + MARQUEE_GAP));
    return Math.max(1, Math.ceil(minimumItems / products.length));
  });

  const sequenceProducts = useMemo(
    () => Array.from({ length: copiesPerSequence }, () => products).flat(),
    [copiesPerSequence, products],
  );

  const normalizeScrollPosition = useCallback(() => {
    const viewport = viewportRef.current;
    const sequenceWidth = sequenceWidthRef.current;
    if (!viewport || sequenceWidth === 0) return;
    if (viewport.scrollLeft >= sequenceWidth * 2) viewport.scrollLeft -= sequenceWidth;
    else if (viewport.scrollLeft <= 0) viewport.scrollLeft += sequenceWidth;
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateCopies = () => {
      const minimumItems = Math.ceil((viewport.clientWidth + MARQUEE_CARD_WIDTH) / (MARQUEE_CARD_WIDTH + MARQUEE_GAP));
      setCopiesPerSequence(Math.max(1, Math.ceil(minimumItems / products.length)));
    };
    updateCopies();
    const observer = new ResizeObserver(updateCopies);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [products.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const sequenceWidth = sequenceRef.current?.offsetWidth ?? 0;
    sequenceWidthRef.current = sequenceWidth;
    if (viewport && sequenceWidth) viewport.scrollLeft = sequenceWidth;
  }, [sequenceProducts]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animate = (time: number) => {
      const viewport = viewportRef.current;
      if (viewport && !pausedRef.current && !interactingRef.current) {
        const previous = previousTimeRef.current ?? time;
        viewport.scrollLeft += (Math.min(time - previous, 50) / 1000) * MARQUEE_SPEED_PX_PER_SECOND;
        normalizeScrollPosition();
      }
      previousTimeRef.current = time;
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [normalizeScrollPosition]);

  useEffect(() => () => {
    if (resumeTimeoutRef.current !== null) window.clearTimeout(resumeTimeoutRef.current);
  }, []);

  const finishInteraction = () => {
    if (resumeTimeoutRef.current !== null) window.clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = window.setTimeout(() => {
      normalizeScrollPosition();
      interactingRef.current = false;
      previousTimeRef.current = null;
    }, 700);
  };

  const renderSequence = (sequenceIndex: number) => (
    <div
      ref={sequenceIndex === 1 ? sequenceRef : undefined}
      className="flex shrink-0 gap-4 pe-4"
      aria-hidden={sequenceIndex === 1 ? undefined : true}
    >
      {sequenceProducts.map((product, index) => {
        const displayPrice = product.pricingOptions?.length
          ? Math.min(...product.pricingOptions.map((option) => option.salePrice ?? option.price))
          : product.salePrice ?? product.price;
        const duration = product.pricingOptions?.length
          ? [...product.pricingOptions].sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price))[0].duration
          : product.duration;
        return (
          <Link
            key={`${sequenceIndex}-${product.id}-${index}`}
            href={`/products/${product.slug}`}
            tabIndex={sequenceIndex === 1 ? undefined : -1}
            className="flex-shrink-0 w-[200px] bg-white rounded-[16px] border border-black/[0.05] shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200 cursor-pointer"
            style={{ textDecoration: 'none' }}
          >
            <div className="w-full h-[110px] bg-gradient-to-br from-secondary/20 to-primary/20 relative overflow-hidden">
              {product.coverImageUrl ? (
                <img src={product.coverImageUrl} alt={product.name} className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                  <span className="text-white/60 font-display font-bold text-2xl">{product.name.charAt(0)}</span>
                </div>
              )}
              <span className="absolute top-2 start-2 bg-white/90 backdrop-blur-sm text-secondary text-[10px] font-bold px-2 py-0.5 rounded-full">
                {duration}
              </span>
              <span className={`absolute bottom-2 start-2 ${productTagBaseClass} ${getAvailabilityBadgeClass(product.availability)}`}>
                {formatProductTag(product.availability)}
              </span>
              {product.badges[0] && (
                <span className={`absolute top-2 end-2 ${productTagBaseClass} ${getProductBadgeClass(product.badges[0])}`}>
                  {formatProductTag(product.badges[0])}
                </span>
              )}
            </div>
            <div className="p-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <p className="font-display font-semibold text-sm text-foreground truncate mb-1">{product.name}</p>
              <p className="text-primary font-bold text-sm">EGP {displayPrice}</p>
              {typeof product.soldCount === 'number' && product.soldCount > 0 && (
                <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200">
                  <TrendingUp className="w-2.5 h-2.5" />
                  {lang === 'ar'
                    ? `${product.soldCount.toLocaleString('ar-EG')}+ عدد مرات البيع`
                    : `${product.soldCount.toLocaleString()}+ sold`}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label={lang === 'ar' ? 'عرض المنتجات المتحرك' : 'Product showcase'}
      dir="ltr"
      className="w-full overflow-x-auto overflow-y-hidden overscroll-x-contain no-scrollbar px-4"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; previousTimeRef.current = null; }}
      onPointerDown={(event) => { if (event.pointerType !== 'mouse') interactingRef.current = true; }}
      onPointerUp={(event) => { if (event.pointerType !== 'mouse') finishInteraction(); }}
      onPointerCancel={(event) => { if (event.pointerType !== 'mouse') finishInteraction(); }}
      onScroll={() => {
        normalizeScrollPosition();
        if (interactingRef.current) finishInteraction();
      }}
      onFocusCapture={() => { pausedRef.current = true; }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          pausedRef.current = false;
          previousTimeRef.current = null;
        }
      }}
    >
      <div className="flex w-max">{[0, 1, 2].map(renderSequence)}</div>
    </div>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: products, isLoading } = useListProducts();
  const { data: categories } = useListCategories();
  const { t, lang } = useLang();
  const [managedReviews, setManagedReviews] = useState<ManagedReview[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reviews', { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Unable to load reviews')))
      .then((data: ManagedReview[]) => setManagedReviews(data))
      .catch(error => { if (error.name !== 'AbortError') setManagedReviews([]); });
    return () => controller.abort();
  }, []);

  const filteredProducts = products?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === null || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const totalSold = products?.reduce((sum, p) => sum + (p.soldCount ?? 0), 0) ?? 0;

  const badges = [
    { icon: CheckCircle2, label: t('officialAccess') },
    { icon: Zap, label: t('instantActivation') },
    { icon: ShieldCheck, label: t('verifiedPartners') },
    { icon: Clock, label: t('support247') },
    { icon: Shield, label: t('securePayment') },
  ];

  const pillBase = "px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap";
  const pillActive = `${pillBase} bg-primary text-white shadow-sm shadow-primary/20`;
  const pillInactive = `${pillBase} bg-white border border-black/[0.07] text-muted-foreground hover:text-foreground hover:border-black/20`;

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative w-full bg-gradient-to-br from-secondary to-primary overflow-hidden">
        {/* Floating brand logos — animated decorative background */}
        {(() => {
          // Gemini: 4-pointed sparkle path
          const geminiPath = 'M50 3 C50 32 68 50 97 50 C68 50 50 68 50 97 C50 68 32 50 3 50 C32 50 50 32 50 3Z';
          // Claude: 12-spoke asterisk
          const claudeSpokes = Array.from({ length: 12 }, (_, i) => i);

          const logos: Array<{
            kind: 'chatgpt' | 'netflix' | 'claude' | 'gemini';
            top: string; left?: string; right?: string;
            size: number; rotate: number; dur: number; dy: number;
          }> = [
            { kind: 'chatgpt', top: '8%',  left: '3%',   size: 68, rotate: -12, dur: 6.2, dy: 14 },
            { kind: 'netflix', top: '70%', left: '11%',  size: 50, rotate: -8,  dur: 8.3, dy: 12 },
            { kind: 'claude',  top: '55%', left: '2%',   size: 58, rotate: 8,   dur: 7.8, dy: 10 },
            { kind: 'gemini',  top: '20%', left: '13%',  size: 52, rotate: 6,   dur: 5.5, dy: 18 },
            { kind: 'netflix', top: '80%', left: '24%',  size: 44, rotate: 14,  dur: 6.7, dy: 16 },
            { kind: 'chatgpt', top: '5%',  left: '30%',  size: 40, rotate: -5,  dur: 9.1, dy: 8  },
            { kind: 'chatgpt', top: '40%', right: '3%',  size: 72, rotate: 10,  dur: 7.0, dy: 20 },
            { kind: 'gemini',  top: '8%',  right: '10%', size: 60, rotate: -6,  dur: 5.8, dy: 15 },
            { kind: 'netflix', top: '68%', right: '5%',  size: 54, rotate: -14, dur: 8.6, dy: 11 },
            { kind: 'claude',  top: '22%', right: '20%', size: 46, rotate: 9,   dur: 6.4, dy: 17 },
            { kind: 'chatgpt', top: '60%', right: '17%', size: 42, rotate: -10, dur: 7.5, dy: 13 },
            { kind: 'claude',  top: '3%',  right: '32%', size: 38, rotate: 7,   dur: 5.2, dy: 9  },
          ];

          return logos.map((logo, i) => {
            const baseStyle: React.CSSProperties = {
              position: 'absolute',
              top: logo.top,
              left: logo.left,
              right: logo.right,
              width: logo.size,
              height: logo.size,
              opacity: 0.1,
              transform: `rotate(${logo.rotate}deg)`,
              pointerEvents: 'none',
              userSelect: 'none',
            };

            if (logo.kind === 'claude') {
              return (
                <motion.svg
                  key={i}
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                  animate={{ y: [0, -logo.dy, 0] }}
                  transition={{ duration: logo.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                  style={baseStyle}
                >
                  {claudeSpokes.map(j => (
                    <rect key={j} x="46.5" y="12" width="7" height="28" rx="3.5" fill="white"
                          transform={`rotate(${j * 30} 50 50)`} />
                  ))}
                </motion.svg>
              );
            }

            if (logo.kind === 'gemini') {
              return (
                <motion.svg
                  key={i}
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                  animate={{ y: [0, -logo.dy, 0] }}
                  transition={{ duration: logo.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                  style={baseStyle}
                >
                  <path d={geminiPath} fill="white" />
                </motion.svg>
              );
            }

            if (logo.kind === 'chatgpt' || logo.kind === 'netflix') {
              return (
                <motion.svg
                  key={i}
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                  animate={{ y: [0, -logo.dy, 0] }}
                  transition={{ duration: logo.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                  style={baseStyle}
                >
                  {logo.kind === 'chatgpt' ? (
                    <g fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6">
                      <path d="M50 18c7.2 0 13.3 4.1 15.9 10.1a17 17 0 0 1 18.7 10.4 17 17 0 0 1-3.3 21.1 17 17 0 0 1-18.7 18.8A17 17 0 0 1 44.2 82a17 17 0 0 1-21.1-3.3A17 17 0 0 1 23 60a17 17 0 0 1-10.4-18.7 17 17 0 0 1 18.7-10.4A17 17 0 0 1 50 18Z" />
                      <path d="m50 18-8.1 14.1m24 7.8-16.2 0m24.8 19.7-15.9-9.2M62.6 78.4l-8.1-14.1m-24 7.8 16.2 0M22 52.4l15.9 9.2" />
                    </g>
                  ) : (
                    <path fill="white" d="M20 13h15l30 74H50L20 13Zm45 0h15v74H65V13Z" />
                  )}
                </motion.svg>
              );
            }

            return (
              <motion.img
                key={i}
                src={`/hero-logos/${logo.kind}.png`}
                alt=""
                aria-hidden="true"
                animate={{ y: [0, -logo.dy, 0] }}
                transition={{ duration: logo.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                style={{ ...baseStyle, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
              />
            );
          });
        })()}

        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 flex flex-col items-center text-center">
          <motion.h1
            key={`hero-${lang}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className={`text-4xl md:text-6xl font-display font-bold text-white mb-6 max-w-3xl whitespace-pre-line ${lang === 'en' ? 'tracking-tight' : 'leading-relaxed'}`}
          >
            {t('heroTitle')}
          </motion.h1>
          <motion.p
            key={`sub-${lang}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-white/80 text-lg md:text-xl max-w-2xl font-medium"
          >
            {t('heroSubtitle')}
          </motion.p>
        </div>
      </section>

      {/* Trust Badges */}
      <div className="bg-white border-b border-black/[0.03]">
        <div className="max-w-7xl mx-auto px-6 py-8 overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-center min-w-max md:min-w-0 gap-8 md:gap-16">
            {badges.map((badge, i) => (
              <div key={i} className="flex items-center gap-2 text-secondary font-medium text-sm">
                <badge.icon className="w-5 h-5 flex-shrink-0" />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Store statistics */}
      <section className="w-full bg-[#07111E] border-b border-white/5 py-10 md:py-14">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { value: '5k+', ar: 'عميل سعيد', en: 'Happy customers' },
            { value: `${totalSold.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en')}+`, ar: 'عملية شراء ناجحة', en: 'Successful purchases' },
            { value: '30+', ar: 'خدمة رقمية', en: 'Digital services' },
            { value: '3+', ar: 'سنين خبرة', en: 'Years of experience' },
          ].map((stat) => (
            <div key={stat.en}>
              <p className="font-display text-4xl md:text-5xl font-bold text-cyan-400 drop-shadow-[0_0_18px_rgba(34,211,238,0.25)]">{stat.value}</p>
              <p className="mt-3 text-base md:text-xl text-slate-300">{lang === 'ar' ? stat.ar : stat.en}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Product Marquee ── */}
      {products && products.length > 0 && (
        <div className="w-full bg-[#F7F9FC] border-b border-black/[0.04] py-6 overflow-hidden">
          <ProductMarquee products={products} lang={lang} />
        </div>
      )}

      {/* Main Content */}
      <div id="products" className="max-w-7xl mx-auto px-6 py-16 w-full flex-1 scroll-mt-32">
        {/* Search */}
        <div className="flex justify-center mb-8">
          <div className="relative w-full max-w-xl">
            <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-black/[0.06] rounded-full py-4 ps-12 pe-6 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Category filter pills */}
        {categories && categories.length > 0 && (
          <div className="flex items-center gap-2 mb-10 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={selectedCategory === null ? pillActive : pillInactive}
            >
              {t('allCategories')}
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                className={selectedCategory === cat.name ? pillActive : pillInactive}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-[20px] h-[280px] md:h-[380px] animate-pulse border border-black/[0.03]">
                <div className="h-[130px] md:h-[200px] bg-muted w-full rounded-t-[20px]" />
                <div className="p-6">
                  <div className="h-4 bg-muted w-1/3 rounded mb-4" />
                  <div className="h-6 bg-muted w-3/4 rounded mb-2" />
                  <div className="h-4 bg-muted w-full rounded mb-6" />
                  <div className="h-10 bg-muted w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-display font-medium text-foreground mb-2">{t('noProductsTitle')}</h3>
            {searchQuery && <p>{t('noProductsBody')} "{searchQuery}".</p>}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              layout
              className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6"
            >
              {filteredProducts.map((product) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Reviews section ── */}
      <section className="w-full bg-gradient-to-b from-[#F7F9FC] to-white py-20 border-t border-black/[0.04]">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded-full mb-4">
              <Star className="w-3.5 h-3.5 fill-primary" />
              {lang === 'ar' ? 'آراء العملاء' : 'Customer Reviews'}
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
              {lang === 'ar' ? 'ماذا يقول عملاؤنا؟' : 'What Our Customers Say'}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              {lang === 'ar'
                ? 'تقييمات حقيقية من عملاء موثوقين عبر فيسبوك'
                : 'Genuine reviews from verified customers on Facebook'}
            </p>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...managedReviews.map(review => ({
              name: review.reviewerName,
              initials: review.reviewerName.charAt(0).toUpperCase(),
              date: new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${review.reviewDate}T00:00:00Z`)),
              dateEn: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${review.reviewDate}T00:00:00Z`)),
              text: review.content,
              color: 'from-primary to-secondary',
            })), ...REVIEWS].map((review, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className="bg-white rounded-[20px] border border-black/[0.05] shadow-sm p-6 flex flex-col gap-4 hover:shadow-md transition-shadow"
                dir="rtl"
              >
                {/* Stars */}
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, s) => (
                    <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                {/* Text */}
                <p className="text-foreground text-sm leading-relaxed font-medium flex-1 whitespace-pre-line">
                  "{review.text}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-2 border-t border-black/[0.05]">
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${review.color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                    {review.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-foreground truncate">{review.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Facebook className="w-3 h-3 text-[#1877F2]" />
                      {lang === 'ar' ? review.date : review.dateEn}
                    </div>
                  </div>
                  <div className="ms-auto flex-shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1877F2] bg-[#1877F2]/10 px-2 py-1 rounded-full">
                      <Facebook className="w-2.5 h-2.5" />
                      Facebook
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* ── Follow Us section ── */}
      <section className="w-full bg-gradient-to-br from-secondary to-primary py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">
            {lang === 'ar' ? 'تابعنا على' : 'Follow Us On'}
          </h2>
          <p className="text-white/70 text-sm mb-10">
            {lang === 'ar' ? 'ابق على اطلاع بأحدث العروض والمنتجات' : 'Stay up to date with our latest deals and products'}
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            {/* Facebook */}
            <a
              href="https://www.facebook.com/61576345803301"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 bg-white/10 hover:bg-[#1877F2] border border-white/20 hover:border-[#1877F2] text-white font-semibold px-6 py-3.5 rounded-full transition-all duration-200 hover:shadow-lg hover:shadow-[#1877F2]/30 hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </a>

            {/* Instagram */}
            <a
              href="https://www.instagram.com/_key.topia_/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 bg-white/10 hover:bg-gradient-to-br hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#FCAF45] border border-white/20 hover:border-transparent text-white font-semibold px-6 py-3.5 rounded-full transition-all duration-200 hover:shadow-lg hover:shadow-pink-500/30 hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              Instagram
            </a>

            {/* WhatsApp Channel */}
            <a
              href="https://whatsapp.com/channel/0029Vb8qpfNLSmbRDaWOV01M"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 bg-white/10 hover:bg-[#25D366] border border-white/20 hover:border-[#25D366] text-white font-semibold px-6 py-3.5 rounded-full transition-all duration-200 hover:shadow-lg hover:shadow-[#25D366]/30 hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>

            {/* Telegram */}
            <a
              href="https://t.me/Keytopiastore"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 bg-white/10 hover:bg-[#229ED9] border border-white/20 hover:border-[#229ED9] text-white font-semibold px-6 py-3.5 rounded-full transition-all duration-200 hover:shadow-lg hover:shadow-[#229ED9]/30 hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Telegram
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
}

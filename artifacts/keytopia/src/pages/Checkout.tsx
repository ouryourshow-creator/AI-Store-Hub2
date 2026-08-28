import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, ChevronLeft, Copy, Check, ExternalLink,
  User, Mail, Phone, CreditCard, Tag, CheckCircle2, AlertCircle,
  MessageCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { SignIn, useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useCart, CartItem } from '../contexts/CartContext';
import Layout from '../components/Layout';
import { useLang } from '../contexts/LanguageContext';
import { getGetMyCashbackQueryKey, useCreateOrder, useGetMyCashback, useGetEgpUsdRate } from '@workspace/api-client-react';

type PaymentMethod = 'instapay' | 'vodafone' | 'bank' | 'binance' | 'other' | null;

interface PromoState {
  status: 'idle' | 'loading' | 'valid' | 'invalid';
  code: string;
  percentage: number;
}

// wa.me requires an international number containing digits only.
const WA_NUMBER = '201229327902';
const WA_LINK = `https://wa.me/${WA_NUMBER}`;

const PAYMENT_INFO = {
  instapay: { link: 'https://ipn.eg/S/batsilitohsbc/instapay/7Gr2jR' },
  vodafone: { number: '01016712243' },
  bank: { accountNumber: '004-253829-001', iban: 'EG860025000400000004253829001', bank: 'HSBC Egypt' },
  binance: { userId: '798379678' },
};

// Binance Pay only settles in USD. When a product has no admin-set USD price yet,
// approximate its USD value from the EGP price using an admin-editable fallback
// rate (see the Settings tab in the admin panel) so the option still works before
// every product has a USD price configured.

/** USD unit price for a cart item: prefer the admin-set USD price (by duration, then product-level), else approximate via the fallback rate. */
function getItemUsdUnitPrice(item: CartItem, fallbackEgpPerUsd: number): number {
  const option = item.pricingOptions?.find((opt) => opt.duration === item.selectedDuration);
  const usd = option ? (option.salePriceUsd ?? option.priceUsd) : (item.salePriceUsd ?? item.priceUsd);
  if (usd != null) return usd;
  return item.selectedCurrency === 'USD' ? item.selectedPrice : item.selectedPrice / fallbackEgpPerUsd;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1.5 rounded-lg hover:bg-black/10 transition-colors text-muted-foreground hover:text-foreground"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#1CC88A]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function Checkout() {
  const { items, cartTotal, clearCart } = useCart();
  const { t, dir } = useLang();
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const isRtl = dir === 'rtl';
  const createOrder = useCreateOrder();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<PromoState>({ status: 'idle', code: '', percentage: 0 });
  const [cashbackInput, setCashbackInput] = useState('');
  const [appliedCashback, setAppliedCashback] = useState(0);
  const [cashbackError, setCashbackError] = useState('');
  const cartCurrency = items[0]?.selectedCurrency ?? 'EGP';
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const { data: cashbackAccount, isLoading: cashbackLoading } = useGetMyCashback({
    query: { enabled: !!isSignedIn, queryKey: getGetMyCashbackQueryKey() },
  });
  // Admin-editable EGP->USD fallback rate (see the Settings tab in the admin panel).
  // 52 is only a last-resort default while the rate is still loading.
  const { data: egpUsdRateData } = useGetEgpUsdRate();
  const fallbackEgpPerUsd = egpUsdRateData?.rate ?? 52;

  const discountAmount = promo.status === 'valid' ? Math.round(cartTotal * promo.percentage / 100) : 0;
  const beforeCashbackTotal = Math.max(0, cartTotal - discountAmount);
  const availableCashback = cashbackAccount?.balances.find((balance) => balance.currency === cartCurrency)?.available ?? 0;
  const finalTotal = Math.max(0, beforeCashbackTotal - appliedCashback);
  const cashbackToEarn = Math.round(finalTotal * 5) / 100;

  // Binance Pay always settles in USD. For an EGP cart, approximate the USD-equivalent
  // of the final (discounted) total by applying the same discount ratio to the USD unit total.
  const usdCartTotal = items.reduce((sum, item) => sum + getItemUsdUnitPrice(item, fallbackEgpPerUsd) * item.quantity, 0);
  const discountRatio = cartTotal > 0 ? finalTotal / cartTotal : 0;
  const binanceUsdTotal = cartCurrency === 'USD'
    ? finalTotal
    : Math.round(usdCartTotal * discountRatio * 100) / 100;

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromo({ status: 'loading', code: '', percentage: 0 });
    try {
      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, productIds: items.map(i => i.id) }),
      });
      const data = await res.json();
      if (data.valid) {
        setPromo({ status: 'valid', code: data.code, percentage: data.percentage });
      } else {
        setPromo({ status: 'invalid', code: '', percentage: 0 });
      }
    } catch {
      setPromo({ status: 'invalid', code: '', percentage: 0 });
    }
  };

  const clearPromo = () => {
    setPromo({ status: 'idle', code: '', percentage: 0 });
    setPromoInput('');
  };

  const handleApplyCashback = () => {
    const amount = Math.round(Number(cashbackInput) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > availableCashback || amount > beforeCashbackTotal) {
      setCashbackError(t('cashbackInvalid'));
      return;
    }
    setAppliedCashback(amount);
    setCashbackError('');
  };

  const clearCashback = () => {
    setAppliedCashback(0);
    setCashbackInput('');
    setCashbackError('');
  };

  const handleClose = () => setLocation('/');

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) return;
    setStep(2);
  };

  const handlePaymentSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    if (method === 'other') {
      void handleSendProof(method);
    } else {
      setStep(3);
    }
  };

  const handleSendProof = async (selectedMethod: Exclude<PaymentMethod, null> = paymentMethod as Exclude<PaymentMethod, null>) => {
    if (!selectedMethod || createOrder.isPending) return;
    // Open during the click. Opening after the async order request is blocked by browsers.
    const proofWindow = window.open('', '_blank');
    if (proofWindow) {
      proofWindow.document.title = isRtl ? 'جار تجهيز الطلب...' : 'Preparing your order...';
      proofWindow.document.body.textContent = isRtl ? 'جار فتح واتساب...' : 'Opening WhatsApp...';
      proofWindow.opener = null;
    }
    const methodLabel: Record<string, string> = {
      instapay: 'Instapay',
      vodafone: isRtl ? 'فودافون كاش' : 'Vodafone Cash',
      bank: isRtl ? 'تحويل بنكي (HSBC)' : 'Bank Transfer (HSBC)',
      binance: 'Binance Pay',
      other: isRtl ? 'طريقة بديلة' : 'Alternative method',
    };
    try {
      const order = await createOrder.mutateAsync({
        data: {
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          currency: cartCurrency,
          idempotencyKey: idempotencyKeyRef.current,
          promoCode: promo.status === 'valid' ? promo.code : null,
          cashbackAmount: appliedCashback || undefined,
          referralCode: localStorage.getItem('keytopia_referral') ?? undefined,
          paymentMethod: selectedMethod,
          items: items.map(item => ({
            productId: item.id,
            duration: item.selectedDuration,
            quantity: item.quantity,
          })),
        },
      });
      const orderLines = order.items.map(
        item => `• ${item.productName} (${item.duration}) ×${item.quantity} — ${order.currency} ${item.lineTotal}`
      ).join('\n');
      const promoLine = order.discount > 0 ? `\n${t('discount')}: -${order.currency} ${order.discount}` : '';
      const cashbackLine = appliedCashback > 0
        ? `\n${isRtl ? 'الكاش باك المستخدم' : 'Cashback redeemed'}: -${cartCurrency} ${appliedCashback.toFixed(2)}`
        : '';
      const binanceLine = selectedMethod === 'binance' && cartCurrency === 'EGP'
        ? `\n${isRtl ? 'المبلغ المحوّل عبر Binance' : 'Amount transferred via Binance'}: USD ${binanceUsdTotal}`
        : '';
      const method = methodLabel[selectedMethod] ?? selectedMethod;
      const msg = selectedMethod === 'other'
        ? (isRtl
          ? `مرحباً، أريد إتمام هذا الطلب عبر طريقة دفع أخرى.\n\nرقم الحجز: ${order.orderNumber}\nالاسم: ${name}\nالبريد: ${email}\nالهاتف: ${phone}\n\nالطلب:\n${orderLines}${promoLine}${cashbackLine}\n\nالإجمالي: ${order.currency} ${order.total}\nطريقة الدفع: ${method}\n\nأرجو التواصل معي لتنسيق الدفع.`
          : `Hello, I would like to complete this order using another payment method.\n\nBooking number: ${order.orderNumber}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nOrder:\n${orderLines}${promoLine}${cashbackLine}\n\nTotal: ${order.currency} ${order.total}\nPayment method: ${method}\n\nPlease contact me to arrange payment.`)
        : (isRtl
          ? `مرحباً، أرسل لكم إيصال الدفع لطلبي من كيتوبيا.\n\nرقم الحجز: ${order.orderNumber}\nالاسم: ${name}\nالبريد: ${email}\nالهاتف: ${phone}\n\nالطلب:\n${orderLines}${promoLine}${cashbackLine}\n\nالإجمالي: ${order.currency} ${order.total}\nطريقة الدفع: ${method}${binanceLine}\n\n[أرجو إرفاق إيصال الدفع]\n\nهذا هو الإيصال`
          : `Hello, I am sending payment proof for my Keytopia order.\n\nBooking number: ${order.orderNumber}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nOrder:\n${orderLines}${promoLine}${cashbackLine}\n\nTotal: ${order.currency} ${order.total}\nPayment method: ${method}${binanceLine}\n\n[Please attach payment proof]`);
      const proofUrl = `${WA_LINK}?text=${encodeURIComponent(msg)}`;
      if (proofWindow) proofWindow.location.replace(proofUrl);
      else window.location.assign(proofUrl);
      queryClient.invalidateQueries({ queryKey: getGetMyCashbackQueryKey() });
      clearCart();
      setLocation('/orders');
    } catch {
      proofWindow?.close();
      // The generated mutation retains its error state for the checkout button message.
    }
  };

  const inputCls = 'w-full bg-muted border border-transparent rounded-[14px] px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all';

  const steps = [
    { n: 1, label: isRtl ? 'معلوماتك' : 'Your Info' },
    { n: 2, label: isRtl ? 'الدفع' : 'Payment' },
    { n: 3, label: isRtl ? 'إيصال الدفع' : 'Proof' },
  ];

  if (items.length === 0) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center bg-[#F7F9FC] px-4 py-12" dir={dir}>
          <div className="w-full max-w-md rounded-[24px] border border-black/[0.04] bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-display font-bold text-foreground">{t('cartEmpty')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('cartEmptySub')}</p>
            <button type="button" onClick={handleClose} className="mt-6 w-full rounded-[16px] bg-primary px-5 py-3 font-semibold text-white">
              {isRtl ? 'العودة إلى المتجر' : 'Back to store'}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center bg-[#F7F9FC] px-4 py-12">
          {!isLoaded ? (
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          ) : (
            <SignIn
              routing="path"
              path={`${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/sign-in`}
              signUpUrl={`${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/sign-up`}
              forceRedirectUrl={`${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/checkout`}
              signUpForceRedirectUrl={`${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/checkout`}
            />
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full bg-[#F7F9FC] px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-card w-full max-w-2xl mx-auto rounded-[24px] shadow-lg border border-black/[0.04] overflow-hidden"
          dir={dir}
        >
            {/* Header */}
            <div className="relative flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((current) => Math.max(1, current - 1))}
                    aria-label={isRtl ? 'الرجوع للخطوة السابقة' : 'Go back to the previous step'}
                    className="p-2 -ms-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
                  >
                    {isRtl ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                  </button>
                )}
                <h1 className="text-xl font-display font-bold">{t('completeOrder')}</h1>
              </div>
              <button onClick={handleClose} aria-label={isRtl ? 'إغلاق صفحة الدفع' : 'Close checkout'} className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step indicators */}
            <div className="px-6 pb-5">
              <div className="flex items-center gap-0">
                {steps.map((s, idx) => (
                  <div key={s.n} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        step > s.n
                          ? 'bg-[#1CC88A] text-white'
                          : step === s.n
                          ? 'bg-primary text-white shadow-md shadow-primary/30'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {step > s.n ? <Check className="w-4 h-4" /> : s.n}
                      </div>
                      <span className={`text-[10px] font-semibold transition-colors ${step === s.n ? 'text-primary' : 'text-muted-foreground'}`}>
                        {s.label}
                      </span>
                    </div>
                    {idx < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-colors duration-300 ${step > s.n ? 'bg-[#1CC88A]' : 'bg-muted'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step content */}
            <div className="px-6 pb-6">
              <AnimatePresence mode="wait">

                {/* ── Step 1: Contact Info ── */}
                {step === 1 && (
                  <motion.form
                    key="step1"
                    initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleStep1Next}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 ms-1">
                        <User className="w-3 h-3" />{t('fullName')}
                      </label>
                      <input type="text" required value={name} onChange={e => setName(e.target.value)}
                        placeholder={t('fullNamePlaceholder')} className={inputCls} />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 ms-1">
                        <Mail className="w-3 h-3" />{t('emailAddress')}
                      </label>
                      <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        placeholder={t('emailPlaceholder')} dir="ltr" className={inputCls} />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 ms-1">
                        <Phone className="w-3 h-3" />{t('phoneNumber')}
                      </label>
                      <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder={t('phonePlaceholder')} dir="ltr" className={inputCls} />
                    </div>

                    {/* Promo code */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 ms-1">
                        <Tag className="w-3 h-3" />{t('promoCode')} <span className="normal-case text-[10px] font-normal">({t('optional')})</span>
                      </label>
                      {promo.status === 'valid' ? (
                        <div className="flex items-center gap-3 bg-[#1CC88A]/10 border border-[#1CC88A]/30 rounded-[14px] px-4 py-3">
                          <CheckCircle2 className="w-4 h-4 text-[#1CC88A] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#1CC88A]">{t('promoApplied')}</p>
                            <p className="text-xs text-muted-foreground font-mono">{promo.code} — {promo.percentage}% {t('discount')}</p>
                          </div>
                          <button type="button" onClick={clearPromo} className="p-1 rounded-full hover:bg-black/10 transition-colors">
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input type="text" value={promoInput}
                            onChange={e => { setPromoInput(e.target.value.toUpperCase()); if (promo.status === 'invalid') setPromo({ status: 'idle', code: '', percentage: 0 }); }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleApplyPromo(); } }}
                            placeholder={t('promoCodePlaceholder')} dir="ltr"
                            className="flex-1 bg-muted border-none rounded-[14px] px-4 py-3.5 text-sm font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground text-foreground focus:ring-2 focus:ring-primary outline-none transition-all" />
                          <button type="button" onClick={handleApplyPromo}
                            disabled={!promoInput.trim() || promo.status === 'loading'}
                            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-sm rounded-[14px] transition-all disabled:opacity-50 whitespace-nowrap">
                            {promo.status === 'loading' ? '...' : t('applyPromo')}
                          </button>
                        </div>
                      )}
                      {promo.status === 'invalid' && (
                        <p className="mt-1.5 text-xs text-destructive flex items-center gap-1 ms-1">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />{t('promoInvalid')}
                        </p>
                      )}
                    </div>

                    {/* Order summary */}
                    <div className="rounded-[16px] border border-emerald-200 bg-emerald-50/60 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-bold text-emerald-800">{t('cashbackUse')}</p>
                          <p className="text-xs text-emerald-700/80">{t('cashbackAvailable')}</p>
                        </div>
                        <span className="font-display font-bold text-emerald-700">
                          {cashbackLoading ? '...' : `${cartCurrency} ${availableCashback.toFixed(2)}`}
                        </span>
                      </div>
                      {appliedCashback > 0 ? (
                        <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2.5">
                          <span className="text-sm font-semibold text-emerald-800">{t('cashbackApplied')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-emerald-700">−{cartCurrency} {appliedCashback.toFixed(2)}</span>
                            <button type="button" onClick={clearCashback} className="p-1 rounded-full hover:bg-emerald-100">
                              <X className="w-3.5 h-3.5 text-emerald-700" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={cashbackInput}
                            onChange={(e) => { setCashbackInput(e.target.value); setCashbackError(''); }}
                            placeholder={t('cashbackAmount')}
                            disabled={!isSignedIn || cashbackLoading || availableCashback <= 0}
                            className="min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60"
                          />
                          <button
                            type="button"
                            onClick={handleApplyCashback}
                            disabled={!cashbackInput || !isSignedIn || cashbackLoading || availableCashback <= 0}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {t('cashbackApply')}
                          </button>
                        </div>
                      )}
                      {cashbackError && <p className="mt-2 text-xs font-medium text-destructive">{cashbackError}</p>}
                    </div>

                    <div className="rounded-[16px] border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-primary">{isRtl ? 'الكاش باك من هذا الطلب' : 'Cashback from this order'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {isRtl ? 'يصبح متاحاً بعد تأكيد الطلب.' : 'This becomes available after the order is confirmed.'}
                          </p>
                        </div>
                        <span className="shrink-0 font-display text-lg font-bold text-primary">{cartCurrency} {cashbackToEarn.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-[16px] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('items')}</p>
                      <div className="flex flex-col gap-1 mb-3">
                        {items.map(item => (
                          <div key={`${item.id}-${item.selectedDuration}`} className="flex justify-between text-sm">
                            <span className="text-foreground/80 truncate max-w-[200px]">{item.name} ({item.selectedDuration})</span>
                            <span className="font-semibold">{item.selectedCurrency ?? cartCurrency} {item.selectedPrice * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      {promo.status === 'valid' && (
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[#1CC88A] font-semibold">{t('discount')} ({promo.percentage}%)</span>
                          <span className="text-[#1CC88A] font-semibold">−{cartCurrency} {discountAmount}</span>
                        </div>
                      )}
                      {appliedCashback > 0 && (
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-emerald-700 font-semibold">{t('cashback')}</span>
                          <span className="text-emerald-700 font-semibold">−{cartCurrency} {appliedCashback.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-display font-bold text-base pt-2 border-t border-black/[0.06]">
                        <span>{t('total')}</span>
                        <span className="text-primary">{cartCurrency} {finalTotal}</span>
                      </div>
                    </div>

                    <button type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-4 rounded-[18px] transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2">
                      {t('next')}
                      {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </motion.form>
                )}

                {/* ── Step 2: Payment Method ── */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-3"
                  >
                    <p className="text-sm text-muted-foreground mb-1">{t('choosePaymentMethod')}</p>

                    {/* Instapay */}
                    <button type="button" onClick={() => handlePaymentSelect('instapay')}
                      className="flex items-center gap-4 w-full bg-white border-2 border-transparent hover:border-primary rounded-[16px] p-4 text-start transition-all hover:shadow-md group">
                      <div className="w-10 h-10 rounded-[10px] bg-[#E8F5FF] flex items-center justify-center flex-shrink-0">
                        <span className="text-[#007AFF] font-bold text-xs">IP</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-foreground">Instapay</p>
                        <p className="text-xs text-muted-foreground">{t('instapayDesc')}</p>
                      </div>
                      {isRtl ? <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />}
                    </button>

                    {/* Vodafone Cash */}
                    <button type="button" onClick={() => handlePaymentSelect('vodafone')}
                      className="flex items-center gap-4 w-full bg-white border-2 border-transparent hover:border-primary rounded-[16px] p-4 text-start transition-all hover:shadow-md group">
                      <div className="w-10 h-10 rounded-[10px] bg-[#FFF0F0] flex items-center justify-center flex-shrink-0">
                        <span className="text-[#E60000] font-bold text-xs">VC</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-foreground">{isRtl ? 'فودافون كاش' : 'Vodafone Cash'}</p>
                        <p className="text-xs text-muted-foreground">{t('vodafoneDesc')}</p>
                      </div>
                      {isRtl ? <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />}
                    </button>

                    {/* Bank Transfer */}
                    <button type="button" onClick={() => handlePaymentSelect('bank')}
                      className="flex items-center gap-4 w-full bg-white border-2 border-transparent hover:border-primary rounded-[16px] p-4 text-start transition-all hover:shadow-md group">
                      <div className="w-10 h-10 rounded-[10px] bg-[#FFF8E8] flex items-center justify-center flex-shrink-0">
                        <CreditCard className="w-5 h-5 text-[#C89B3C]" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-foreground">{t('bankTransfer')}</p>
                        <p className="text-xs text-muted-foreground">{t('bankDesc')}</p>
                      </div>
                      {isRtl ? <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />}
                    </button>

                    {/* Binance Pay always settles in USD; for EGP carts we quote the USD equivalent. */}
                    <button type="button" onClick={() => handlePaymentSelect('binance')}
                      className="flex items-center gap-4 w-full bg-white border-2 border-transparent hover:border-primary rounded-[16px] p-4 text-start transition-all hover:shadow-md group">
                      <div className="w-10 h-10 rounded-[10px] bg-[#FFF7D6] flex items-center justify-center flex-shrink-0">
                        <span className="text-[#B8860B] font-bold text-xs">BN</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-foreground">Binance Pay</p>
                        <p className="text-xs text-muted-foreground">{isRtl ? 'حوّل ما يعادل إجمالي طلبك بالدولار باستخدام معرّف Binance' : 'Transfer the USD equivalent of your order using the Binance user ID'}</p>
                      </div>
                      {isRtl ? <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />}
                    </button>

                    {/* Other */}
                    <button type="button" onClick={() => handlePaymentSelect('other')}
                      className="flex items-center gap-4 w-full bg-white border-2 border-transparent hover:border-primary rounded-[16px] p-4 text-start transition-all hover:shadow-md group">
                      <div className="w-10 h-10 rounded-[10px] bg-[#F0FFF5] flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-5 h-5 text-[#1CC88A]" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-foreground">{t('otherMethods')}</p>
                        <p className="text-xs text-muted-foreground">{t('otherMethodsDesc')}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>

                    <button type="button" onClick={() => setStep(1)}
                      className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      {t('back')}
                    </button>
                  </motion.div>
                )}

                {/* ── Step 3: Payment Details + Proof ── */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-4"
                  >
                    <p className="text-sm text-muted-foreground">{t('paymentProofInstructions')}</p>

                    {/* Instapay details */}
                    {paymentMethod === 'instapay' && (
                      <div className="bg-[#E8F5FF]/60 border border-[#007AFF]/20 rounded-[16px] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#007AFF] mb-3">Instapay</p>
                        <p className="text-sm text-muted-foreground mb-2">{t('instapayClickLink')}</p>
                        <a href={PAYMENT_INFO.instapay.link} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-[#007AFF] text-white text-sm font-semibold px-4 py-3 rounded-[12px] hover:bg-[#0063CC] transition-colors w-full justify-center">
                          {t('payViaInstapay')}
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}

                    {/* Vodafone Cash details */}
                    {paymentMethod === 'vodafone' && (
                      <div className="bg-[#FFF0F0]/60 border border-[#E60000]/20 rounded-[16px] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#E60000] mb-3">{isRtl ? 'فودافون كاش' : 'Vodafone Cash'}</p>
                        <p className="text-sm text-muted-foreground mb-2">{t('sendToNumber')}</p>
                        <div className="flex items-center gap-3 bg-white rounded-[10px] px-4 py-3 border border-[#E60000]/20">
                          <span className="font-mono font-bold text-lg tracking-widest text-foreground flex-1" dir="ltr">
                            {PAYMENT_INFO.vodafone.number}
                          </span>
                          <CopyButton text={PAYMENT_INFO.vodafone.number} />
                        </div>
                      </div>
                    )}

                    {/* Bank Transfer details */}
                    {paymentMethod === 'bank' && (
                      <div className="bg-[#FFF8E8]/60 border border-[#C89B3C]/20 rounded-[16px] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#C89B3C] mb-3">{PAYMENT_INFO.bank.bank}</p>
                        <div className="flex flex-col gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('accountNumber')}</p>
                            <div className="flex items-center gap-3 bg-white rounded-[10px] px-4 py-3 border border-[#C89B3C]/20">
                              <span className="font-mono font-semibold text-sm text-foreground flex-1" dir="ltr">
                                {PAYMENT_INFO.bank.accountNumber}
                              </span>
                              <CopyButton text={PAYMENT_INFO.bank.accountNumber} />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">IBAN</p>
                            <div className="flex items-center gap-3 bg-white rounded-[10px] px-4 py-3 border border-[#C89B3C]/20">
                              <span className="font-mono font-semibold text-xs text-foreground flex-1 break-all" dir="ltr">
                                {PAYMENT_INFO.bank.iban}
                              </span>
                              <CopyButton text={PAYMENT_INFO.bank.iban} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'binance' && (
                      <div className="rounded-[16px] border border-[#F3BA2F]/40 bg-[#FFF7D6]/70 p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8A6500]">Binance Pay</p>
                        <p className="mb-2 text-sm text-muted-foreground">{isRtl ? `حوّل USD ${binanceUsdTotal} إلى معرّف مستخدم Binance التالي:` : `Transfer USD ${binanceUsdTotal} to this Binance user ID:`}</p>
                        {cartCurrency === 'EGP' && (
                          <p className="mb-2 text-xs text-muted-foreground">{isRtl ? `(ما يعادل ${cartCurrency} ${finalTotal} بسعر تحويل تقريبي)` : `(approximate USD equivalent of ${cartCurrency} ${finalTotal})`}</p>
                        )}
                        <div className="flex items-center gap-3 rounded-[10px] border border-[#F3BA2F]/40 bg-white px-4 py-3">
                          <span className="flex-1 font-mono text-lg font-bold tracking-widest" dir="ltr">{PAYMENT_INFO.binance.userId}</span>
                          <CopyButton text={PAYMENT_INFO.binance.userId} />
                        </div>
                        <p className="mt-2 text-xs font-medium text-[#8A6500]">{isRtl ? 'تحقق من المعرّف والمبلغ قبل تأكيد التحويل.' : 'Verify the ID and amount before confirming the transfer.'}</p>
                      </div>
                    )}

                    {/* Order total reminder */}
                    <div className="flex justify-between items-center bg-muted/50 rounded-[14px] px-4 py-3">
                      <span className="text-sm text-muted-foreground">{t('total')}</span>
                      <span className="font-display font-bold text-primary text-lg">{cartCurrency} {finalTotal}</span>
                    </div>

                    {/* WhatsApp proof button */}
                    <div className="bg-[#F0FFF5] border border-[#1CC88A]/30 rounded-[16px] p-4">
                      <p className="text-sm font-semibold text-foreground mb-1">{t('afterPayment')}</p>
                      <p className="text-xs text-muted-foreground mb-3">{t('sendProofExplain')}</p>
                       <button type="button" onClick={() => void handleSendProof()} disabled={createOrder.isPending}
                        className="w-full bg-[#1CC88A] hover:bg-[#1CC88A]/90 text-white font-semibold py-4 px-4 rounded-[16px] transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 disabled:opacity-60">
                        <MessageCircle className="w-5 h-5" />
                        {t('sendProofViaWhatsApp')}
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      {createOrder.isError && (
                        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                          {isRtl ? 'تعذر إنشاء الطلب. تحقق من بياناتك وحاول مرة أخرى.' : 'The order could not be created. Check your details and try again.'}
                        </p>
                      )}
                    </div>

                    <button type="button" onClick={() => setStep(2)}
                      className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      {t('back')}
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
        </motion.div>
      </div>
    </Layout>
  );
}

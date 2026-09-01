import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, ChevronLeft, Copy, Check, ExternalLink,
  User, Mail, Phone, CreditCard, Tag, CheckCircle2, AlertCircle,
  MessageCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SignIn, useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useCart, CartItem } from '../contexts/CartContext';
import Layout from '../components/Layout';
import { useLang } from '../contexts/LanguageContext';
import { getGetMyCashbackQueryKey, useCreateOrder, useGetMyCashback, useGetEgpUsdRate } from '@workspace/api-client-react';

type PaymentMethod = 'instapay' | 'vodafone' | 'paypal' | 'card' | null;
type PayCurrency = 'EGP' | 'USD';

declare global { interface Window { paypal?: any } }

type PayPalMethod = 'paypal' | 'card';

type PayPalCheckoutProps = {
  method: PayPalMethod;
  createOrder: () => Promise<string>;
  onSuccess: (id: string) => Promise<void>;
  onError: (message: string) => void;
  isRtl: boolean;
  disabled: boolean;
};

function PayPalCheckout({ method, createOrder, onSuccess, onError, isRtl, disabled }: PayPalCheckoutProps) {
  const buttonsContainer = useRef<HTMLDivElement>(null);
  const [cardFields, setCardFields] = useState<any>(null);

  useEffect(() => {
    if (!window.paypal) return;
    let active = true;
    if (method === 'paypal' && buttonsContainer.current) {
      buttonsContainer.current.replaceChildren();
      const buttons = window.paypal.Buttons({
        fundingSource: window.paypal.FUNDING.PAYPAL,
        style: { layout: 'vertical', shape: 'pill', label: 'paypal' },
        createOrder,
        onApprove: (data: { orderID: string }) => onSuccess(data.orderID),
        onCancel: () => onError(isRtl ? 'تم إلغاء الدفع. يمكنك المحاولة مرة أخرى.' : 'Payment was cancelled. You can try again.'),
        onError: () => onError(isRtl ? 'تعذر إكمال الدفع باستخدام PayPal. حاول مرة أخرى.' : 'PayPal could not complete the payment. Please retry.'),
      });
      buttons.render(buttonsContainer.current);
      return () => { active = false; buttons.close?.(); };
    }

    const fields = window.paypal.CardFields?.({
      createOrder,
      onApprove: (data: { orderID: string }) => onSuccess(data.orderID),
      onError: () => onError(isRtl ? 'تم رفض البطاقة أو تعذر معالجتها. تحقق من البيانات وحاول مرة أخرى.' : 'The card was declined or could not be processed. Check the details and retry.'),
    });
    if (fields?.isEligible?.()) {
      fields.NameField().render('#paypal-card-name');
      fields.NumberField().render('#paypal-card-number');
      fields.ExpiryField().render('#paypal-card-expiry');
      fields.CVVField().render('#paypal-card-cvv');
      if (active) setCardFields(fields);
    }
    return () => { active = false; };
  }, [method]);

  if (method === 'paypal') return <div className={disabled ? 'pointer-events-none opacity-60' : ''} ref={buttonsContainer} />;
  return <div className="space-y-2 rounded-xl border border-black/10 bg-white p-3 sm:p-4">
    <div id="paypal-card-name" className="h-11 min-w-0 overflow-hidden rounded-lg border p-2" />
    <div id="paypal-card-number" className="h-11 min-w-0 overflow-hidden rounded-lg border p-2" />
    <div className="grid min-w-0 grid-cols-2 gap-2"><div id="paypal-card-expiry" className="h-11 min-w-0 overflow-hidden rounded-lg border p-2" /><div id="paypal-card-cvv" className="h-11 min-w-0 overflow-hidden rounded-lg border p-2" /></div>
    <button type="button" disabled={disabled || !cardFields} onClick={() => cardFields?.submit()} className="w-full rounded-xl bg-[#0070ba] p-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isRtl ? 'الدفع بالبطاقة' : 'Pay by card'}</button>
  </div>;
}

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
};

/** USD unit price for a cart item: prefer the admin-set USD price (by duration, then product-level), else approximate via the fallback rate. */
function getItemUsdUnitPrice(item: CartItem, fallbackEgpPerUsd: number): number {
  const option = item.pricingOptions?.find((opt) => opt.duration === item.selectedDuration);
  const usd = option ? (option.salePriceUsd ?? option.priceUsd) : (item.salePriceUsd ?? item.priceUsd);
  if (usd != null) return usd;
  return item.selectedCurrency === 'USD' ? item.selectedPrice : item.selectedPrice / fallbackEgpPerUsd;
}

function getItemEgpUnitPrice(item: CartItem, fallbackEgpPerUsd: number): number {
  const option = item.pricingOptions?.find((opt) => opt.duration === item.selectedDuration);
  if (option?.salePrice != null || option?.price != null) return option.salePrice ?? option.price;
  return item.selectedCurrency === 'EGP' ? item.selectedPrice : item.selectedPrice * fallbackEgpPerUsd;
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
  const { items, clearCart, markCartRecovered } = useCart();
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
  const [payCurrency, setPayCurrency] = useState<PayCurrency>('EGP');
  const [paypalError, setPaypalError] = useState('');
  const [paypalBusy, setPaypalBusy] = useState(false);
  const [paypalSdkState, setPaypalSdkState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [cardEligible, setCardEligible] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<PromoState>({ status: 'idle', code: '', percentage: 0 });
  const [cashbackInput, setCashbackInput] = useState('');
  const [appliedCashback, setAppliedCashback] = useState(0);
  const [cashbackError, setCashbackError] = useState('');
  const cartCurrency = payCurrency;
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const { data: cashbackAccount, isLoading: cashbackLoading } = useGetMyCashback({
    query: { enabled: !!isSignedIn, queryKey: getGetMyCashbackQueryKey() },
  });
  // Admin-editable EGP->USD fallback rate (see the Settings tab in the admin panel).
  // 52 is only a last-resort default while the rate is still loading.
  const { data: egpUsdRateData } = useGetEgpUsdRate();
  const fallbackEgpPerUsd = egpUsdRateData?.rate ?? 52;

  const egpCartTotal = items.reduce((sum, item) => sum + getItemEgpUnitPrice(item, fallbackEgpPerUsd) * item.quantity, 0);
  const baseTotal = payCurrency === 'USD' ? items.reduce((sum, item) => sum + getItemUsdUnitPrice(item, fallbackEgpPerUsd) * item.quantity, 0) : egpCartTotal;
  const discountAmount = promo.status === 'valid' ? Math.round(baseTotal * promo.percentage) / 100 : 0;
  const beforeCashbackTotal = Math.max(0, baseTotal - discountAmount);
  const availableCashback = cashbackAccount?.balances.find((balance) => balance.currency === cartCurrency)?.available ?? 0;
  const finalTotal = Math.max(0, beforeCashbackTotal - appliedCashback);
  const cashbackToEarn = Math.round(finalTotal * 5) / 100;

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
    setPaypalError('');
    setStep(3);
  };

  const createPayPalOrder = async () => {
    if (paypalBusy) throw new Error('busy');
    setPaypalBusy(true); setPaypalError('');
    try {
      const order = await createOrder.mutateAsync({ data: { customerName: name.trim(), customerEmail: email.trim(), customerPhone: phone.trim(), currency: 'USD', idempotencyKey: idempotencyKeyRef.current, promoCode: promo.status === 'valid' ? promo.code : null, cashbackAmount: appliedCashback || undefined, referralCode: localStorage.getItem('keytopia_referral') ?? undefined, paymentMethod: 'paypal', items: items.map(item => ({ productId: item.id, duration: item.selectedDuration, quantity: item.quantity })) } });
      const response = await fetch('/api/paypal/orders', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localOrderId: order.id }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'PayPal unavailable'); return result.paypalOrderId as string;
    } finally { setPaypalBusy(false); }
  };
  const capturePayPalOrder = async (paypalOrderId: string) => {
    if (paypalBusy) return; setPaypalBusy(true); setPaypalError('');
    try { const response = await fetch(`/api/paypal/orders/${encodeURIComponent(paypalOrderId)}/capture`, { method: 'POST', credentials: 'include' }); const result = await response.json(); if (!response.ok || !result.completed) throw new Error(result.error || 'Capture declined'); await markCartRecovered(result.orderId); clearCart(); setLocation('/orders?payment=success'); }
    catch (error) { setPaypalError(error instanceof Error ? error.message : 'Payment failed'); }
    finally { setPaypalBusy(false); }
  };

  useEffect(() => {
    if (payCurrency !== 'USD' || paypalSdkState !== 'idle') return;
    let active = true;
    setPaypalSdkState('loading');
    fetch('/api/paypal/config').then(response => response.json()).then(config => {
      if (!config.available || !config.clientId) throw new Error('unavailable');
      const inspectEligibility = () => {
        if (!active || !window.paypal) return;
        setCardEligible(Boolean(window.paypal.CardFields?.({ createOrder: createPayPalOrder })?.isEligible?.()));
        setPaypalSdkState('ready');
      };
      if (window.paypal) { inspectEligibility(); return; }
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=USD&intent=capture&components=buttons,card-fields`;
      script.async = true;
      script.onload = inspectEligibility;
      script.onerror = () => active && setPaypalSdkState('unavailable');
      document.head.appendChild(script);
    }).catch(() => active && setPaypalSdkState('unavailable'));
    return () => { active = false; };
  }, [payCurrency, paypalSdkState]);

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
      const method = methodLabel[selectedMethod] ?? selectedMethod;
      const msg = isRtl
        ? `مرحباً، أرسل لكم إيصال الدفع لطلبي من كيتوبيا.\n\nرقم الحجز: ${order.orderNumber}\nالاسم: ${name}\nالبريد: ${email}\nالهاتف: ${phone}\n\nالطلب:\n${orderLines}${promoLine}${cashbackLine}\n\nالإجمالي: ${order.currency} ${order.total}\nطريقة الدفع: ${method}\n\n[أرجو إرفاق إيصال الدفع]\n\nهذا هو الإيصال`
        : `Hello, I am sending payment proof for my Keytopia order.\n\nBooking number: ${order.orderNumber}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nOrder:\n${orderLines}${promoLine}${cashbackLine}\n\nTotal: ${order.currency} ${order.total}\nPayment method: ${method}\n\n[Please attach payment proof]`;
      const proofUrl = `${WA_LINK}?text=${encodeURIComponent(msg)}`;
      if (proofWindow) proofWindow.location.replace(proofUrl);
      else window.location.assign(proofUrl);
      queryClient.invalidateQueries({ queryKey: getGetMyCashbackQueryKey() });
      await markCartRecovered(order.id);
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
    { n: 3, label: payCurrency === 'EGP' ? (isRtl ? 'إيصال الدفع' : 'Payment proof') : (isRtl ? 'تأكيد الطلب' : 'Confirm order') },
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
      <div className="w-full bg-[#F7F9FC] px-4 py-8 pb-32 md:py-12 md:pb-12">
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

                {/* ── Step 2: Currency and payment method ── */}
                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">{isRtl ? 'اختر عملة الدفع أولاً، ثم طريقة الدفع.' : 'Choose the payment currency first, then a payment method.'}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={isRtl ? 'عملة الدفع' : 'Payment currency'}>
                      {(['EGP', 'USD'] as const).map(currency => {
                        const selected = payCurrency === currency;
                        return <button key={currency} type="button" role="radio" aria-checked={selected} onClick={() => { setPayCurrency(currency); setPaymentMethod(null); setPaypalError(''); clearCashback(); idempotencyKeyRef.current = crypto.randomUUID(); }} className={`flex min-w-0 items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-start transition ${selected ? 'border-primary bg-primary/5' : 'border-black/10 bg-white'}`}>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-primary text-white' : 'bg-muted text-transparent'}`}><Check className="h-3.5 w-3.5" /></span>
                          <span className="min-w-0"><span className="block truncate text-sm font-bold">{currency === 'EGP' ? (isRtl ? 'الدفع بالجنيه المصري' : 'Pay in EGP') : (isRtl ? 'الدفع بالدولار' : 'Pay in USD')}</span><span className="text-xs text-muted-foreground">{currency}</span></span>
                        </button>;
                      })}
                    </div>
                    {payCurrency === 'EGP' ? <div className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-2 sm:grid-cols-2">
                      <button type="button" onClick={() => handlePaymentSelect('instapay')} className="flex min-w-0 items-center gap-3 rounded-xl border-2 border-transparent bg-white p-3 text-start shadow-sm hover:border-primary"><span className="shrink-0 rounded-lg bg-blue-50 p-2.5 font-bold text-blue-600">IP</span><span className="min-w-0"><span className="block font-semibold">{isRtl ? 'إنستاباي' : 'Instapay'}</span><span className="block text-xs text-muted-foreground">{t('instapayDesc')}</span></span></button>
                      <button type="button" onClick={() => handlePaymentSelect('vodafone')} className="flex min-w-0 items-center gap-3 rounded-xl border-2 border-transparent bg-white p-3 text-start shadow-sm hover:border-primary"><span className="shrink-0 rounded-lg bg-red-50 p-2.5 font-bold text-red-600">VC</span><span className="min-w-0"><span className="block font-semibold">{isRtl ? 'فودافون كاش' : 'Vodafone Cash'}</span><span className="block text-xs text-muted-foreground">{t('vodafoneDesc')}</span></span></button>
                    </div> : <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                      <p className="text-sm text-muted-foreground">{isRtl ? 'سيتم تحصيل قيمة طلبك بالدولار الأمريكي. اختر الدفع باستخدام PayPal أو بطاقة ائتمان أو خصم.' : 'Your order will be charged in US dollars. Choose PayPal or a credit or debit card.'}</p>
                      <button type="button" onClick={() => setPaymentMethod('paypal')} aria-pressed={paymentMethod === 'paypal'} className={`flex w-full min-w-0 items-center gap-3 rounded-xl border-2 bg-white p-3 text-start transition ${paymentMethod === 'paypal' ? 'border-[#0070ba] shadow-sm' : 'border-transparent'}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-bold text-[#0070ba]">P</span><span className="min-w-0 flex-1"><span className="block font-semibold">PayPal</span><span className="block text-xs text-muted-foreground">{isRtl ? 'الدفع باستخدام حساب PayPal' : 'Pay using your PayPal account'}</span></span>{paymentMethod === 'paypal' && <Check className="h-5 w-5 shrink-0 text-[#0070ba]" />}</button>
                      <button type="button" disabled={paypalSdkState !== 'ready' || !cardEligible} onClick={() => { setPaymentMethod('card'); setStep(3); }} aria-pressed={paymentMethod === 'card'} className={`flex w-full min-w-0 items-center gap-3 rounded-xl border-2 bg-white p-3 text-start transition disabled:cursor-not-allowed disabled:opacity-60 ${paymentMethod === 'card' ? 'border-[#0070ba] shadow-sm' : 'border-transparent'}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100"><CreditCard className="h-5 w-5 text-slate-700" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{isRtl ? 'بطاقة ائتمان أو خصم' : 'Credit or debit card'}</span><span className="block text-xs text-muted-foreground">{isRtl ? 'الدفع بالبطاقة بأمان عبر PayPal' : 'Pay securely by card through PayPal'}</span></span>{paymentMethod === 'card' && <Check className="h-5 w-5 shrink-0 text-[#0070ba]" />}</button>
                      {paypalSdkState === 'loading' && <p className="text-xs text-muted-foreground">{isRtl ? 'جار التحقق من توفر الدفع بالبطاقة…' : 'Checking card payment availability…'}</p>}
                      {paypalSdkState === 'ready' && !cardEligible && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{isRtl ? 'الدفع بالبطاقة غير متاح حالياً. يمكنك المتابعة باستخدام PayPal.' : 'Card payment is currently unavailable. You can continue using PayPal.'}</p>}
                      {paypalSdkState === 'unavailable' && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-destructive">{isRtl ? 'PayPal غير متاح حالياً. حاول مرة أخرى لاحقاً.' : 'PayPal is currently unavailable. Please try again later.'}</p>}
                      <div className="grid gap-1 rounded-xl bg-white p-3 text-sm">
                        <div className="flex min-w-0 justify-between gap-3"><span>{isRtl ? 'إجمالي الطلب' : 'Order total'}</span><b className="shrink-0">{egpCartTotal.toLocaleString(isRtl ? 'ar-EG' : 'en-US')} {isRtl ? 'جنيه' : 'EGP'}</b></div>
                        <div className="flex min-w-0 justify-between gap-3 text-primary"><span>{isRtl ? 'المبلغ المطلوب عبر PayPal' : 'Amount due through PayPal'}</span><b className="shrink-0">{finalTotal.toFixed(2)} {isRtl ? 'دولار' : 'USD'}</b></div>
                      </div>
                      {paymentMethod === 'paypal' && <button type="button" disabled={paypalSdkState !== 'ready' || paypalBusy} onClick={() => setStep(3)} className="w-full rounded-xl bg-[#0070ba] p-3 font-semibold text-white disabled:opacity-50">{isRtl ? 'الدفع باستخدام PayPal' : 'Pay using PayPal'}</button>}
                    </div>}
                    <button type="button" onClick={() => setStep(1)} className="text-sm text-muted-foreground">{t('back')}</button>
                  </motion.div>
                )}
                {step === 3 && payCurrency === 'EGP' && (
                  <motion.div key="egp-details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                    {paymentMethod === 'instapay' && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><b>Instapay</b><a href={PAYMENT_INFO.instapay.link} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-xl bg-blue-600 p-3 text-center font-semibold text-white">{t('payViaInstapay')}</a></div>}
                    {paymentMethod === 'vodafone' && <div className="rounded-xl border border-red-200 bg-red-50 p-4"><b>{isRtl ? 'فودافون كاش' : 'Vodafone Cash'}</b><div className="mt-3 flex min-w-0 rounded-xl bg-white p-3"><span className="min-w-0 flex-1 font-mono" dir="ltr">{PAYMENT_INFO.vodafone.number}</span><CopyButton text={PAYMENT_INFO.vodafone.number} /></div></div>}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="mb-3 text-sm">{t('sendProofExplain')}</p><button type="button" disabled={createOrder.isPending} onClick={() => void handleSendProof()} className="w-full rounded-xl bg-emerald-600 p-3 font-semibold text-white disabled:opacity-50">{t('sendProofViaWhatsApp')}</button></div>
                    <button type="button" onClick={() => setStep(2)} className="text-sm text-muted-foreground">{t('back')}</button>
                  </motion.div>
                )}
                {step === 3 && payCurrency === 'USD' && paymentMethod && (
                  <motion.div key={`paypal-${paymentMethod}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-w-0 flex-col gap-3">
                    <div className="grid gap-1 rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-sm"><div className="flex min-w-0 justify-between gap-3"><span>{isRtl ? 'إجمالي الطلب' : 'Order total'}</span><b className="shrink-0">{egpCartTotal.toLocaleString(isRtl ? 'ar-EG' : 'en-US')} {isRtl ? 'جنيه' : 'EGP'}</b></div><div className="flex min-w-0 justify-between gap-3 text-primary"><span>{isRtl ? 'المبلغ المطلوب عبر PayPal' : 'Amount due through PayPal'}</span><b className="shrink-0">{finalTotal.toFixed(2)} {isRtl ? 'دولار' : 'USD'}</b></div></div>
                    {paypalBusy && <p className="text-center text-sm text-muted-foreground">{isRtl ? 'جار إنشاء الطلب أو تأكيد الدفع بأمان…' : 'Securely creating the order or confirming payment…'}</p>}
                    <PayPalCheckout method={paymentMethod as PayPalMethod} createOrder={createPayPalOrder} onSuccess={capturePayPalOrder} onError={setPaypalError} isRtl={isRtl} disabled={paypalBusy} />
                    {paypalError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-destructive">{paypalError}</p>}
                    <button type="button" disabled={paypalBusy} onClick={() => setStep(2)} className="text-sm text-muted-foreground">{t('back')}</button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
        </motion.div>
      </div>
    </Layout>
  );
}

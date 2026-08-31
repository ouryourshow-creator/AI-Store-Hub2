import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, ChevronLeft, Copy, Check, ExternalLink,
  User, Mail, Phone, CreditCard, Tag, CheckCircle2, AlertCircle,
  MessageCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMyCashbackQueryKey, useCreateOrder, useGetMyCashback } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { useCart } from '../contexts/CartContext';
import { useLang } from '../contexts/LanguageContext';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaymentMethod = 'instapay' | 'vodafone' | 'bank' | 'other' | null;

interface PromoState {
  status: 'idle' | 'loading' | 'valid' | 'invalid';
  code: string;
  percentage: number;
}

const WA_NUMBER = '+201229327902';
const WA_LINK = `https://wa.me/${encodeURIComponent(WA_NUMBER)}`;

const PAYMENT_INFO = {
  instapay: { link: 'https://ipn.eg/S/batsilitohsbc/instapay/7Gr2jR' },
  vodafone: { number: '01016712243' },
  bank: { accountNumber: '004-253829-001', iban: 'EG860025000400000004253829001', bank: 'HSBC Egypt' },
};

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

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { items, cartTotal, clearCart, markCartRecovered } = useCart();
  const { t, dir, lang } = useLang();
  const { isSignedIn } = useAuth();
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

  const discountAmount = promo.status === 'valid' ? Math.round(cartTotal * promo.percentage / 100) : 0;
  const beforeCashbackTotal = Math.max(0, cartTotal - discountAmount);
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

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setName(''); setEmail(''); setPhone('');
      setPaymentMethod(null);
      clearPromo();
      clearCashback();
      idempotencyKeyRef.current = crypto.randomUUID();
    }, 300);
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) return;
    if (!isSignedIn) {
      setLocation('/sign-in');
      return;
    }
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
    // Open during the click so the browser does not block WhatsApp after the order request.
    const whatsappWindow = window.open('', '_blank');
    if (whatsappWindow) {
      whatsappWindow.document.title = isRtl ? 'جار فتح واتساب...' : 'Opening WhatsApp...';
      whatsappWindow.document.body.textContent = isRtl ? 'جار تجهيز الطلب...' : 'Preparing your order...';
      whatsappWindow.opener = null;
    }
    const methodLabel: Record<string, string> = {
      instapay: 'Instapay',
      vodafone: isRtl ? 'فودافون كاش' : 'Vodafone Cash',
      bank: isRtl ? 'تحويل بنكي (HSBC)' : 'Bank Transfer (HSBC)',
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
      const method = methodLabel[selectedMethod] ?? selectedMethod;
      const msg = selectedMethod === 'other'
        ? (isRtl
          ? `مرحباً، أريد إتمام هذا الطلب عبر طريقة دفع أخرى.\n\nرقم الحجز: ${order.orderNumber}\nالاسم: ${name}\nالبريد: ${email}\nالهاتف: ${phone}\n\nالطلب:\n${orderLines}${promoLine}\n\nالإجمالي: ${order.currency} ${order.total}\nطريقة الدفع: ${method}\n\nأرجو التواصل معي لتنسيق الدفع.`
          : `Hello, I would like to complete this order using another payment method.\n\nBooking number: ${order.orderNumber}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nOrder:\n${orderLines}${promoLine}\n\nTotal: ${order.currency} ${order.total}\nPayment method: ${method}\n\nPlease contact me to arrange payment.`)
        : (isRtl
          ? `مرحباً، أرسل لكم إيصال الدفع لطلبي من كيتوبيا.\n\nرقم الحجز: ${order.orderNumber}\nالاسم: ${name}\nالبريد: ${email}\nالهاتف: ${phone}\n\nالطلب:\n${orderLines}${promoLine}\n\nالإجمالي: ${order.currency} ${order.total}\nطريقة الدفع: ${method}\n\n[أرجو إرفاق إيصال الدفع]`
          : `Hello, I am sending payment proof for my Keytopia order.\n\nBooking number: ${order.orderNumber}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nOrder:\n${orderLines}${promoLine}\n\nTotal: ${order.currency} ${order.total}\nPayment method: ${method}\n\n[Please attach payment proof]`);
      if (whatsappWindow) whatsappWindow.location.replace(`${WA_LINK}?text=${encodeURIComponent(msg)}`);
      else window.location.assign(`${WA_LINK}?text=${encodeURIComponent(msg)}`);
      queryClient.invalidateQueries({ queryKey: getGetMyCashbackQueryKey() });
      await markCartRecovered(order.id);
      clearCart();
      handleClose();
    } catch {
      whatsappWindow?.close();
      // The generated mutation retains its error state for the checkout button message.
    }
  };

  const inputCls = 'w-full bg-muted border border-transparent rounded-[14px] px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all';

  const steps = [
    { n: 1, label: isRtl ? 'معلوماتك' : 'Your Info' },
    { n: 2, label: isRtl ? 'الدفع' : 'Payment' },
    { n: 3, label: isRtl ? 'إيصال الدفع' : 'Proof' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={e => e.stopPropagation()}
            className="bg-card w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden"
            dir={dir}
          >
            {/* Header */}
            <div className="relative flex items-center justify-between px-6 pt-6 pb-4">
              <h2 className="text-xl font-display font-bold">{t('completeOrder')}</h2>
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground">
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
                          <p className="text-xs text-emerald-700/80">{t('cashbackEarned')}</p>
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
                      <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-sm font-semibold text-primary">
                        {isRtl ? `ستحصل على ${cartCurrency} ${cashbackToEarn.toFixed(2)} كاش باك بعد تأكيد الطلب.` : `You will earn ${cartCurrency} ${cashbackToEarn.toFixed(2)} cashback after this order is confirmed.`}
                      </p>
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}

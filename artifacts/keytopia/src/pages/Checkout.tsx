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

type PayPalOrder = { orderId: string };
type PayPalPaymentMethod = 'paypal' | 'advanced_cards' | 'card';
type PayPalEligibility = {
  isEligible: (method: PayPalPaymentMethod) => boolean;
};
type PayPalPaymentSession = {
  start: (options: { presentationMode: 'auto' }, order: Promise<PayPalOrder>) => Promise<void>;
};
type PayPalErrorPayload = {
  code?: string;
  message?: string;
  paypalDebugId?: string | null;
  requestId?: string;
};
class PayPalCheckoutError extends Error {
  constructor(
    readonly payload: PayPalErrorPayload,
    readonly httpStatus: number | null,
    fallbackMessage: string,
  ) {
    super(payload.message || fallbackMessage);
    this.name = 'PayPalCheckoutError';
  }
}

function errorPayload(value: unknown): PayPalErrorPayload {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  return {
    code: typeof raw.code === 'string' ? raw.code : undefined,
    message: typeof raw.message === 'string' ? raw.message : undefined,
    paypalDebugId: typeof raw.paypalDebugId === 'string' ? raw.paypalDebugId : null,
    requestId: typeof raw.requestId === 'string' ? raw.requestId : undefined,
  };
}

function reportPayPalError(error: unknown, context: string): void {
  if (!import.meta.env.DEV) return;
  if (error instanceof PayPalCheckoutError) {
    console.error(`[PayPal v6] ${context}`, {
      code: error.payload.code,
      message: error.payload.message,
      paypalDebugId: error.payload.paypalDebugId,
      requestId: error.payload.requestId,
      httpStatus: error.httpStatus,
    });
    return;
  }
  console.error(`[PayPal v6] ${context}`, error);
}
type PayPalCardFieldComponent = HTMLElement & { destroy?: () => void };
type PayPalCardFieldsSession = {
  createCardFieldsComponent: (options: {
    type: 'number' | 'expiry' | 'cvv';
    placeholder?: string;
  }) => PayPalCardFieldComponent;
  submit: (
    orderId: string,
    options?: { name?: string; billingAddress?: Record<string, string> },
  ) => Promise<{
    state: 'succeeded' | 'canceled' | 'failed';
    data?: { orderId?: string; message?: string };
  }>;
};
type PayPalSdk = {
  findEligibleMethods: (options: { currencyCode: string; amount: string }) => Promise<PayPalEligibility>;
  createPayPalOneTimePaymentSession: (options: {
    onApprove: (data: { orderId: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
  }) => PayPalPaymentSession;
  createPayPalGuestOneTimePaymentSession?: (options: {
    onApprove: (data: { orderId: string }) => Promise<void>;
  }) => PayPalPaymentSession;
  createCardFieldsOneTimePaymentSession: () => PayPalCardFieldsSession;
};

declare global {
  interface Window {
    paypal?: {
      createInstance: (options: {
        clientId: string;
        components: string[];
        pageType: 'checkout';
      }) => Promise<PayPalSdk>;
    };
  }
}

type PayPalMethod = 'paypal' | 'card';

type PayPalCheckoutProps = {
  method: PayPalMethod;
  cardMode: Exclude<PayPalPaymentMethod, 'paypal'> | null;
  sdk: PayPalSdk;
  createOrder: () => Promise<PayPalOrder>;
  cardholderName: string;
  onSuccess: (id: string) => Promise<void>;
  onError: (message: string) => void;
  isRtl: boolean;
  disabled: boolean;
};

function PayPalCheckout({ method, cardMode, sdk, createOrder, cardholderName, onSuccess, onError, isRtl, disabled }: PayPalCheckoutProps) {
  const buttonsContainer = useRef<HTMLDivElement>(null);
  const cardContainer = useRef<HTMLDivElement>(null);
  const cardSubmitButton = useRef<HTMLButtonElement>(null);
  const [cardReady, setCardReady] = useState(false);

  useEffect(() => {
    let active = true;
    setCardReady(false);

    if (method === 'paypal' && buttonsContainer.current) {
      const button = document.createElement('paypal-button');
      button.setAttribute('type', 'pay');
      buttonsContainer.current.replaceChildren(button);
      const session = sdk.createPayPalOneTimePaymentSession({
        onApprove: ({ orderId }) => onSuccess(orderId),
        onCancel: () => onError(isRtl ? 'تم إلغاء الدفع. يمكنك المحاولة مرة أخرى.' : 'Payment was cancelled. You can try again.'),
        onError: (error) => {
          reportPayPalError(error, 'PayPal session error');
          onError(isRtl ? 'PayPal غير متاح حالياً. حاول مرة أخرى لاحقاً.' : 'PayPal is currently unavailable. Please try again later.');
        },
      });
      const handleClick = () => {
        void session.start({ presentationMode: 'auto' }, createOrder()).catch((error) => {
          reportPayPalError(error, 'PayPal session error');
          if (active) onError(isRtl ? 'PayPal غير متاح حالياً. حاول مرة أخرى لاحقاً.' : 'PayPal is currently unavailable. Please try again later.');
        });
      };
      button.addEventListener('click', handleClick);
      return () => {
        active = false;
        button.removeEventListener('click', handleClick);
        buttonsContainer.current?.replaceChildren();
      };
    }

    if (method !== 'card' || !cardMode || !cardContainer.current) {
      return () => { active = false; };
    }

    const container = cardContainer.current;
    container.replaceChildren();

    if (cardMode === 'card') {
      const basicCardContainer = document.createElement('paypal-basic-card-container');
      const basicCardButton = document.createElement('paypal-basic-card-button');
      basicCardContainer.appendChild(basicCardButton);
      container.appendChild(basicCardContainer);
      const guestSession = sdk.createPayPalGuestOneTimePaymentSession?.({
        onApprove: ({ orderId }) => onSuccess(orderId),
      });

      if (!guestSession) {
        onError(isRtl ? 'الدفع بالبطاقة غير متاح حالياً.' : 'Card payment is currently unavailable.');
        return () => { active = false; container.replaceChildren(); };
      }

      const handleGuestClick = () => {
        void guestSession.start({ presentationMode: 'auto' }, createOrder()).catch((error) => {
          reportPayPalError(error, 'Guest card session error');
          if (active) onError(isRtl ? 'تعذر بدء الدفع بالبطاقة. حاول مرة أخرى.' : 'Card payment could not start. Please try again.');
        });
      };
      basicCardButton.addEventListener('click', handleGuestClick);
      setCardReady(true);
      return () => {
        active = false;
        basicCardButton.removeEventListener('click', handleGuestClick);
        container.replaceChildren();
      };
    }

    const cardSession = sdk.createCardFieldsOneTimePaymentSession();
    const fields = (['number', 'expiry', 'cvv'] as const).map((type) => cardSession.createCardFieldsComponent({
      type,
      placeholder: type === 'number' ? 'Card number' : type === 'expiry' ? 'MM/YY' : 'CVV',
    }));
    fields.forEach((field) => {
      const fieldContainer = document.createElement('div');
      fieldContainer.className = 'mb-2 h-11 min-w-0 overflow-hidden rounded-lg border p-2 last:mb-0';
      fieldContainer.appendChild(field);
      container.appendChild(fieldContainer);
    });
    if (active) setCardReady(true);

    const submitCard = async () => {
      if (!active || disabled) return;
      try {
        const createdOrder = await createOrder();
        const result = await cardSession.submit(createdOrder.orderId, { name: cardholderName.trim() || undefined });
        if (result.state === 'succeeded') {
          await onSuccess(result.data?.orderId ?? createdOrder.orderId);
        } else if (result.state === 'canceled') {
          onError(isRtl ? 'تم إلغاء التحقق من البطاقة. حاول مرة أخرى.' : 'Card verification was cancelled. Please try again.');
        } else {
          onError(result.data?.message || (isRtl ? 'تم رفض البطاقة أو تعذر معالجتها. تحقق من البيانات وحاول مرة أخرى.' : 'The card was declined or could not be processed. Check the details and retry.'));
        }
      } catch (error) {
        reportPayPalError(error, 'Advanced card session error');
        onError(error instanceof PayPalCheckoutError
          ? (isRtl ? 'تعذر بدء الدفع بالبطاقة. حاول مرة أخرى.' : 'Card payment could not start. Please try again.')
          : error instanceof Error ? error.message : (isRtl ? 'تعذر إتمام الدفع بالبطاقة. حاول مرة أخرى.' : 'Card payment failed. Please try again.'));
      }
    };

    const payButton = cardSubmitButton.current;
    const handleSubmitClick = () => { void submitCard(); };
    payButton?.addEventListener('click', handleSubmitClick);
    return () => {
      active = false;
      payButton?.removeEventListener('click', handleSubmitClick);
      fields.forEach((field) => field.destroy?.());
      container.replaceChildren();
    };
  }, [method, cardMode, sdk, cardholderName]);

  if (method === 'paypal') return <div className={disabled ? 'pointer-events-none opacity-60' : ''} ref={buttonsContainer} />;
  return <div className="space-y-2 rounded-xl border border-black/10 bg-white p-3 sm:p-4">
    <div ref={cardContainer} className="min-h-11 min-w-0 overflow-hidden rounded-lg border p-2" />
    {cardMode === 'advanced_cards' && (
      <button ref={cardSubmitButton} type="button" disabled={disabled || !cardReady} className="w-full rounded-xl bg-[#0070ba] p-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isRtl ? 'الدفع بالبطاقة' : 'Pay by card'}</button>
    )}
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

function VisaLogo() {
  return <span className="inline-flex h-7 min-w-12 items-center justify-center rounded bg-[#1434cb] px-2 text-[11px] font-black italic tracking-tight text-white">VISA</span>;
}

function MastercardLogo() {
  return <span className="inline-flex h-7 min-w-12 items-center justify-center rounded bg-white px-1.5" aria-label="Mastercard">
    <span className="-me-1.5 h-5 w-5 rounded-full bg-[#eb001b]" />
    <span className="h-5 w-5 rounded-full bg-[#f79e1b]/95" />
  </span>;
}

function PaypalLogo() {
  return <span className="inline-flex items-center gap-1.5 text-[#003087]">
    <span className="text-2xl font-black italic leading-none text-[#0070ba]">P</span>
    <span className="text-base font-bold tracking-tight">PayPal</span>
  </span>;
}

function InstapayLogo() {
  return <span className="inline-flex items-center gap-1.5 text-[#1683d8]">
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1683d8] text-lg font-black text-white">i</span>
    <span className="text-base font-bold tracking-tight">instapay</span>
  </span>;
}

function VodafoneCashLogo() {
  return <span className="inline-flex items-center gap-1.5 text-[#e60000]">
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e60000] text-sm font-black text-white">V</span>
    <span className="text-sm font-bold leading-tight">Vodafone<br />Cash</span>
  </span>;
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
  const [paypalSdk, setPaypalSdk] = useState<PayPalSdk | null>(null);
  const [paypalEligible, setPaypalEligible] = useState(false);
  const [cardEligibility, setCardEligibility] = useState<Exclude<PayPalPaymentMethod, 'paypal'> | null>(null);
  const preparedPayPalOrderRef = useRef<PayPalOrder | null>(null);
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

  const handlePayPalContinue = async (method: Exclude<PayPalMethod, null>) => {
    if (
      paypalBusy
      || paypalSdkState !== 'ready'
      || (method === 'paypal' && !paypalEligible)
      || (method === 'card' && !cardEligibility)
    ) return;
    setPaymentMethod(method);
    setPaypalError('');
    try {
      preparedPayPalOrderRef.current = await createPayPalOrder();
      setStep(3);
    } catch (error) {
      reportPayPalError(error, 'Prepare PayPal checkout');
      setPaypalError(method === 'card'
        ? (isRtl ? 'تعذر بدء الدفع بالبطاقة. حاول مرة أخرى.' : 'Card payment could not start. Please try again.')
        : (isRtl ? 'PayPal غير متاح حالياً. حاول مرة أخرى لاحقاً.' : 'PayPal is currently unavailable. Please try again later.'));
    }
  };

  const handlePaymentSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setPaypalError('');
    setStep(3);
  };

  const handlePaymentContinue = () => {
    if (!paymentMethod) return;
    if (payCurrency === 'USD') {
      void handlePayPalContinue(paymentMethod as Exclude<PayPalMethod, null>);
    } else {
      handlePaymentSelect(paymentMethod);
    }
  };

  const createPayPalOrder = async (): Promise<PayPalOrder> => {
    if (paypalBusy) throw new Error('busy');
    const preparedOrder = preparedPayPalOrderRef.current;
    if (preparedOrder) {
      preparedPayPalOrderRef.current = null;
      return preparedOrder;
    }
    setPaypalBusy(true); setPaypalError('');
    try {
      const order = await createOrder.mutateAsync({ data: { customerName: name.trim(), customerEmail: email.trim(), customerPhone: phone.trim(), currency: 'USD', idempotencyKey: idempotencyKeyRef.current, promoCode: promo.status === 'valid' ? promo.code : null, cashbackAmount: appliedCashback || undefined, referralCode: localStorage.getItem('keytopia_referral') ?? undefined, paymentMethod: 'paypal', items: items.map(item => ({ productId: item.id, duration: item.selectedDuration, quantity: item.quantity })) } });
      const response = await fetch('/api/paypal/orders', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localOrderId: order.id }) });
      const result = await response.json().catch(() => ({})) as unknown;
      if (!response.ok) {
        throw new PayPalCheckoutError(errorPayload(result), response.status, 'PayPal is currently unavailable');
      }
      if (!result || typeof result !== 'object' || typeof (result as Record<string, unknown>).paypalOrderId !== 'string') {
        throw new PayPalCheckoutError({}, response.status, 'PayPal is currently unavailable');
      }
      return { orderId: (result as Record<string, unknown>).paypalOrderId as string };
    } catch (error) {
      reportPayPalError(error, 'Create PayPal order');
      throw error;
    } finally { setPaypalBusy(false); }
  };
  const capturePayPalOrder = async (paypalOrderId: string) => {
    if (paypalBusy) return; setPaypalBusy(true); setPaypalError('');
    try {
      const response = await fetch(`/api/paypal/orders/${encodeURIComponent(paypalOrderId)}/capture`, { method: 'POST', credentials: 'include' });
      const result = await response.json().catch(() => ({})) as unknown;
      if (!response.ok) throw new PayPalCheckoutError(errorPayload(result), response.status, 'Payment capture failed');
      if (!result || typeof result !== 'object' || !(result as Record<string, unknown>).completed) throw new Error('Capture declined');
      await markCartRecovered((result as Record<string, unknown>).orderId as number);
      clearCart(); setLocation('/orders?payment=success');
    } catch (error) {
      reportPayPalError(error, 'Capture PayPal order');
      setPaypalError(error instanceof PayPalCheckoutError
        ? (isRtl ? 'PayPal غير متاح حالياً. حاول مرة أخرى لاحقاً.' : 'PayPal is currently unavailable. Please try again later.')
        : error instanceof Error ? error.message : 'Payment failed');
    }
    finally { setPaypalBusy(false); }
  };

  useEffect(() => {
    setPaymentMethod(null);
    setPaypalError('');
    preparedPayPalOrderRef.current = null;
    setPaypalSdk(null);
    setPaypalEligible(false);
    setCardEligibility(null);
    let active = true;
    let sdkScript: HTMLScriptElement | null = null;

    if (payCurrency !== 'USD') {
      setPaypalSdkState('idle');
      return () => { active = false; };
    }

    setPaypalSdkState('loading');

    const timeout = window.setTimeout(() => {
      if (active) setPaypalSdkState('unavailable');
    }, 15_000);

    const markUnavailable = () => {
      if (!active) return;
      window.clearTimeout(timeout);
      setPaypalSdkState('unavailable');
      setPaypalSdk(null);
      setPaypalEligible(false);
      setCardEligibility(null);
    };

    const loadSdk = async () => {
      const configResponse = await fetch('/api/paypal/config');
      if (!configResponse.ok) throw new Error('PayPal configuration request failed');
      const config = await configResponse.json() as { available?: boolean; clientId?: string; environment?: 'sandbox' | 'live' };
      if (!config.available || !config.clientId) throw new Error('PayPal is unavailable');

      if (!window.paypal?.createInstance) {
        const sdkUrl = config.environment === 'live'
          ? 'https://www.paypal.com/web-sdk/v6/core'
          : 'https://www.sandbox.paypal.com/web-sdk/v6/core';
        sdkScript = document.querySelector<HTMLScriptElement>('script[data-keytopia-paypal-sdk-v6="true"]');
        if (sdkScript && sdkScript.src !== sdkUrl) {
          sdkScript.remove();
          sdkScript = null;
        }
        if (!sdkScript) {
          sdkScript = document.createElement('script');
          sdkScript.src = sdkUrl;
          sdkScript.async = true;
          sdkScript.dataset.keytopiaPaypalSdkV6 = 'true';
          document.head.appendChild(sdkScript);
        }
        await new Promise<void>((resolve, reject) => {
          if (window.paypal?.createInstance) {
            resolve();
            return;
          }
          const onLoad = () => resolve();
          const onError = () => reject(new Error('PayPal SDK failed to load'));
          sdkScript?.addEventListener('load', onLoad, { once: true });
          sdkScript?.addEventListener('error', onError, { once: true });
        });
      }

      if (!active || !window.paypal?.createInstance) return;
      const sdk = await window.paypal.createInstance({
        clientId: config.clientId,
        components: ['paypal-payments', 'card-fields', 'paypal-guest-payments'],
        pageType: 'checkout',
      });
      const paymentMethods = await sdk.findEligibleMethods({
        currencyCode: 'USD',
        amount: finalTotal.toFixed(2),
      });
      const eligiblePaypal = paymentMethods.isEligible('paypal');
      const eligibleAdvancedCards = paymentMethods.isEligible('advanced_cards');
      const eligibleGuestCards = paymentMethods.isEligible('card');
      if (import.meta.env.DEV) {
        console.debug('[PayPal v6] eligibility', {
          paypal: eligiblePaypal,
          card: eligibleGuestCards,
          advanced_cards: eligibleAdvancedCards,
        });
      }
      if (!active) return;
      setPaypalSdk(sdk);
      setPaypalEligible(eligiblePaypal);
      setCardEligibility(eligibleAdvancedCards ? 'advanced_cards' : eligibleGuestCards ? 'card' : null);
      setPaypalSdkState('ready');
    };

    void loadSdk().catch(markUnavailable);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [payCurrency, finalTotal]);

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

                {/* ── Step 2: Payment method and order summary ── */}
                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid overflow-hidden rounded-[24px] border border-[#d9d0c6] bg-white shadow-sm lg:grid-cols-[1.05fr_.95fr]">
                    <section className="bg-[#f1ede7] p-5 sm:p-8" aria-labelledby="payment-method-heading">
                      <div className="mb-6 flex items-center justify-between gap-3">
                        <h2 id="payment-method-heading" className="font-display text-2xl font-semibold text-[#3e3530]">
                          {isRtl ? 'طريقة الدفع' : 'Payment method'}
                        </h2>
                        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#786e67]">{payCurrency}</span>
                      </div>

                      <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-white/60 p-1.5" role="radiogroup" aria-label={isRtl ? 'عملة الدفع' : 'Payment currency'}>
                        {(['USD', 'EGP'] as const).map(currency => {
                          const selected = payCurrency === currency;
                          return <button
                            key={currency}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => {
                              setPayCurrency(currency);
                              setPaymentMethod(null);
                              setPaypalError('');
                              preparedPayPalOrderRef.current = null;
                              clearCashback();
                              idempotencyKeyRef.current = crypto.randomUUID();
                            }}
                            className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${selected ? 'bg-[#403730] text-white shadow-sm' : 'text-[#786e67] hover:bg-white'}`}
                          >
                            {currency === 'USD' ? (isRtl ? 'الدولار الأمريكي' : 'USD · Dollar') : (isRtl ? 'الجنيه المصري' : 'EGP · Egyptian pound')}
                          </button>;
                        })}
                      </div>

                      {payCurrency === 'USD' ? (
                        <div className="divide-y divide-[#d9d0c6] border-y border-[#d9d0c6]" role="radiogroup" aria-label={isRtl ? 'طرق الدفع بالدولار' : 'USD payment methods'}>
                          <button
                            type="button"
                            disabled={paypalSdkState !== 'ready' || !paypalEligible}
                            onClick={() => setPaymentMethod('card')}
                            aria-checked={paymentMethod === 'card'}
                            role="radio"
                            className={`flex min-h-[76px] w-full items-center gap-3 text-start transition disabled:cursor-not-allowed disabled:opacity-50 ${paymentMethod === 'card' ? 'text-[#302923]' : 'text-[#544a43]'}`}
                          >
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${paymentMethod === 'card' ? 'border-primary' : 'border-[#8d8178]'}`}>
                              {paymentMethod === 'card' && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold">{isRtl ? 'بطاقة خصم أو ائتمان' : 'Debit or credit card'}</span>
                              <span className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Visa and Mastercard">
                                <VisaLogo />
                                <MastercardLogo />
                              </span>
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={paypalSdkState !== 'ready' || !paypalEligible}
                            onClick={() => setPaymentMethod('paypal')}
                            aria-checked={paymentMethod === 'paypal'}
                            role="radio"
                            className={`flex min-h-[76px] w-full items-center gap-3 text-start transition disabled:cursor-not-allowed disabled:opacity-50 ${paymentMethod === 'paypal' ? 'text-[#302923]' : 'text-[#544a43]'}`}
                          >
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${paymentMethod === 'paypal' ? 'border-primary' : 'border-[#8d8178]'}`}>
                              {paymentMethod === 'paypal' && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                            </span>
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                              <span>
                                <span className="block font-semibold">PayPal</span>
                                <span className="mt-1 block text-xs text-[#786e67]">{isRtl ? 'الدفع بأمان عبر حساب PayPal' : 'Pay securely with PayPal'}</span>
                              </span>
                              <PaypalLogo />
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#d9d0c6] border-y border-[#d9d0c6]" role="radiogroup" aria-label={isRtl ? 'طرق الدفع بالجنيه' : 'EGP payment methods'}>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('instapay')}
                            aria-checked={paymentMethod === 'instapay'}
                            role="radio"
                            className={`flex min-h-[82px] w-full items-center gap-3 text-start transition ${paymentMethod === 'instapay' ? 'text-[#302923]' : 'text-[#544a43]'}`}
                          >
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${paymentMethod === 'instapay' ? 'border-primary' : 'border-[#8d8178]'}`}>
                              {paymentMethod === 'instapay' && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold">{isRtl ? 'إنستاباي' : 'Instapay'}</span>
                              <span className="mt-1 block text-xs text-[#786e67]">{t('instapayDesc')}</span>
                            </span>
                            <InstapayLogo />
                          </button>

                          <button
                            type="button"
                            onClick={() => setPaymentMethod('vodafone')}
                            aria-checked={paymentMethod === 'vodafone'}
                            role="radio"
                            className={`flex min-h-[82px] w-full items-center gap-3 text-start transition ${paymentMethod === 'vodafone' ? 'text-[#302923]' : 'text-[#544a43]'}`}
                          >
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${paymentMethod === 'vodafone' ? 'border-primary' : 'border-[#8d8178]'}`}>
                              {paymentMethod === 'vodafone' && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold">{isRtl ? 'فودافون كاش' : 'Vodafone Cash'}</span>
                              <span className="mt-1 block text-xs text-[#786e67]">{t('vodafoneDesc')}</span>
                            </span>
                            <VodafoneCashLogo />
                          </button>
                        </div>
                      )}

                      {paypalSdkState === 'loading' && payCurrency === 'USD' && <p className="mt-4 text-xs text-[#786e67]">{isRtl ? 'جار التحقق من توفر الدفع…' : 'Checking payment availability…'}</p>}
                      {paypalSdkState === 'ready' && payCurrency === 'USD' && !paypalEligible && <p className="mt-4 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{isRtl ? 'PayPal غير متاح حالياً.' : 'PayPal is not currently available.'}</p>}
                      {paypalSdkState === 'unavailable' && payCurrency === 'USD' && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-2 text-xs text-destructive">{isRtl ? 'PayPal غير متاح حالياً. حاول مرة أخرى لاحقاً.' : 'PayPal is currently unavailable. Please try again later.'}</p>}
                      {paypalError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-2 text-xs text-destructive">{paypalError}</p>}

                      <div className="mt-7 flex items-center gap-4">
                        <button type="button" onClick={() => setStep(1)} className="text-sm font-semibold text-[#786e67] transition hover:text-[#403730]">{t('back')}</button>
                        <button
                          type="button"
                          disabled={!paymentMethod || (payCurrency === 'USD' && (paypalSdkState !== 'ready' || !paypalEligible || paypalBusy))}
                          onClick={handlePaymentContinue}
                          className="flex-1 rounded-full bg-[#8f6f63] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#76594f] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isRtl ? 'متابعة' : 'Continue'}
                        </button>
                      </div>
                    </section>

                    <aside className="bg-white p-5 sm:p-8" aria-labelledby="order-summary-heading">
                      <div className="mb-6 flex items-center justify-between gap-3">
                        <h2 id="order-summary-heading" className="font-display text-2xl font-semibold text-[#3e3530]">
                          {isRtl ? 'ملخص الطلب' : 'Order summary'}
                        </h2>
                        <span className="text-sm text-[#948a82]">{items.length} {isRtl ? 'منتج' : items.length === 1 ? 'item' : 'items'}</span>
                      </div>

                      <div className="space-y-4">
                        {items.map(item => {
                          const unitPrice = payCurrency === 'USD' ? getItemUsdUnitPrice(item, fallbackEgpPerUsd) : item.selectedPrice;
                          const currencyLabel = payCurrency === 'USD' ? 'USD' : 'EGP';
                          return <div key={`${item.id}-${item.selectedDuration}`} className="flex items-start justify-between gap-4 border-b border-[#eee8e1] pb-4">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#403730]">{item.name}</p>
                              <p className="mt-1 text-xs text-[#948a82]">{item.selectedDuration} · {isRtl ? `الكمية ${item.quantity}` : `Qty ${item.quantity}`}</p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold text-[#544a43]">{currencyLabel} {(unitPrice * item.quantity).toFixed(2)}</p>
                          </div>;
                        })}
                      </div>

                      <div className="mt-6 space-y-3 text-sm text-[#786e67]">
                        <div className="flex justify-between gap-4">
                          <span>{isRtl ? 'المجموع الفرعي' : 'Subtotal'}</span>
                          <span className="font-semibold text-[#544a43]">{payCurrency} {baseTotal.toFixed(2)}</span>
                        </div>
                        {promo.status === 'valid' && <div className="flex justify-between gap-4 text-emerald-700"><span>{t('discount')} ({promo.percentage}%)</span><span className="font-semibold">−{payCurrency} {discountAmount}</span></div>}
                        {appliedCashback > 0 && <div className="flex justify-between gap-4 text-emerald-700"><span>{t('cashback')}</span><span className="font-semibold">−{payCurrency} {appliedCashback.toFixed(2)}</span></div>}
                      </div>

                      <div className="mt-6 flex items-center justify-between gap-4 border-t border-[#eee8e1] pt-5 text-lg font-bold text-[#302923]">
                        <span>{t('total')}</span>
                        <span>{payCurrency} {finalTotal.toFixed(2)}</span>
                      </div>
                      {payCurrency === 'USD' && <p className="mt-3 text-xs leading-relaxed text-[#948a82]">{isRtl ? `سيتم خصم ${finalTotal.toFixed(2)} دولار أمريكي عبر PayPal.` : `You will be charged ${finalTotal.toFixed(2)} USD through PayPal.`}</p>}
                    </aside>
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
                    {paypalSdk && <PayPalCheckout method={paymentMethod as PayPalMethod} cardMode={cardEligibility} sdk={paypalSdk} createOrder={createPayPalOrder} cardholderName={name} onSuccess={capturePayPalOrder} onError={setPaypalError} isRtl={isRtl} disabled={paypalBusy} />}
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

import { useUser, useClerk, SignIn } from '@clerk/react';
import { getGetMyCashbackQueryKey, getListMyOrdersQueryKey, useGetMyCashback, useListMyOrders } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { format } from 'date-fns';
import { Package, ArrowRight, ArrowLeft, Clock, CheckCircle2, XCircle, FileText, Wallet, ChevronDown, User, Mail, Phone, LogOut } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import Layout from '../components/Layout';
import { useEffect, useState } from 'react';

const StatusBadge = ({ status, dir }: { status: string; dir: 'rtl' | 'ltr' }) => {
  const statusMap: Record<string, { bg: string; text: string; icon: any; labelAr: string; labelEn: string }> = {
    awaiting_payment: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock, labelAr: 'بانتظار الدفع', labelEn: 'Awaiting Payment' },
    payment_proof_received: { bg: 'bg-blue-50', text: 'text-blue-700', icon: FileText, labelAr: 'تم استلام الإيصال', labelEn: 'Proof Received' },
    confirmed: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: CheckCircle2, labelAr: 'مؤكد', labelEn: 'Confirmed' },
    fulfilled: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2, labelAr: 'مكتمل', labelEn: 'Fulfilled' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle, labelAr: 'ملغي', labelEn: 'Cancelled' },
  };

  const config = statusMap[status] || { bg: 'bg-gray-50', text: 'text-gray-700', icon: Clock, labelAr: status, labelEn: status };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      <Icon className="w-3.5 h-3.5" />
      {dir === 'rtl' ? config.labelAr : config.labelEn}
    </span>
  );
};

export default function Orders() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  const [location, setLocation] = useLocation();
  const { dir, t } = useLang();
  const [referral, setReferral] = useState<{ referralCode: string; referralCount: number } | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const toggleOrder = (id: number) => setExpandedOrders((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  useEffect(() => {
    if (isSignedIn) fetch('/api/referral/me', { credentials: 'include' }).then((response) => response.ok ? response.json() : null).then(setReferral);
  }, [isSignedIn]);

  const { data: orders, isLoading } = useListMyOrders({
    query: {
      enabled: !!isSignedIn,
      queryKey: getListMyOrdersQueryKey()
    }
  });
  const { data: cashback, isLoading: cashbackLoading } = useGetMyCashback({
    query: { enabled: !!isSignedIn, queryKey: getGetMyCashbackQueryKey() },
  });
  const latestOrder = orders?.[0];

  if (!isLoaded) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!isSignedIn) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center border border-black/[0.03]">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground mb-3">
              {dir === 'rtl' ? 'تتبع طلباتك' : 'Track Your Orders'}
            </h1>
            <p className="text-muted-foreground mb-8">
              {dir === 'rtl'
                ? 'سجل الدخول لمشاهدة تفاصيل طلباتك السابقة، تتبع حالة التفعيل، والتواصل مع الدعم.'
                : 'Sign in to view your past orders, track activation status, and contact support.'}
            </p>
            <div className="flex justify-center">
              <SignIn
                routing="path"
                path={`${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/sign-in`}
                signUpUrl={`${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/sign-up`}
                forceRedirectUrl={`${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/orders`}
                signUpForceRedirectUrl={`${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/orders`}
              />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const profileName = user?.fullName || latestOrder?.customerName || (dir === 'rtl' ? 'بدون اسم' : 'No name set');
  const profileEmail = user?.primaryEmailAddress?.emailAddress || latestOrder?.customerEmail || '—';
  const profilePhone = user?.primaryPhoneNumber?.phoneNumber || latestOrder?.customerPhone || (dir === 'rtl' ? 'غير متوفر' : 'Not provided');

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 md:py-20">
        {location.includes('payment=success') && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />{dir === 'rtl' ? 'تم الدفع بنجاح وتأكيد طلبك.' : 'Payment successful. Your order is confirmed.'}</div>}
        <div className="flex items-start justify-between gap-3 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-1 md:mb-2">
              {dir === 'rtl' ? 'طلباتي' : 'My Orders'}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {dir === 'rtl' ? 'تتبع وإدارة طلباتك السابقة.' : 'Track and manage your past orders.'}
            </p>
          </div>
          <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
            {dir === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {dir === 'rtl' ? 'العودة للمتجر' : 'Back to Store'}
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-72 lg:flex-shrink-0">
          <div className="bg-white rounded-[24px] border border-black/[0.03] shadow-sm p-6 lg:sticky lg:top-24">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-lg shrink-0">
                {profileName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-foreground truncate">{profileName}</p>
                <p className="text-xs text-muted-foreground">{dir === 'rtl' ? 'الملف الشخصي' : 'Profile'}</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate text-foreground">{profileName}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate text-foreground">{profileEmail}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate text-foreground">{profilePhone}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut(() => setLocation('/'))}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl border border-black/[0.06] py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {dir === 'rtl' ? 'تسجيل الخروج' : 'Sign out'}
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
        <section className="mb-8 rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-11 h-11 rounded-[14px] bg-emerald-100 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{t('cashbackBalance')}</h2>
              <p className="text-sm text-muted-foreground">
                {dir === 'rtl' ? 'يصبح الكاش باك متاحاً للاستخدام بعد اعتماده.' : 'Cashback becomes available to spend after it is approved.'}
              </p>
            </div>
          </div>
          {cashbackLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2].map((item) => <div key={item} className="h-28 rounded-2xl bg-white/70 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(cashback?.balances ?? []).map((balance) => {
                const redeemed = (cashback?.transactions ?? [])
                  .filter((transaction) => transaction.currency === balance.currency && transaction.type === 'debit' && transaction.status === 'redeemed')
                  .reduce((sum, transaction) => sum + transaction.amount, 0);
                return (
                  <div key={balance.currency} className="rounded-2xl bg-white/80 border border-emerald-100 p-4">
                    <p className="text-xs font-bold tracking-wider text-muted-foreground">{balance.currency}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-emerald-700">{t('cashbackAvailable')}</p>
                        <p className="font-display text-lg font-bold text-emerald-700">{balance.available.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{dir === 'rtl' ? 'المستخدم' : 'Redeemed'}</p>
                        <p className="font-display text-lg font-bold text-slate-600">{redeemed.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-amber-700">{t('cashbackPending')}</p>
                        <p className="font-display text-lg font-bold text-amber-700">{balance.pending.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {referral && <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4"><p className="font-bold text-foreground">{dir === 'rtl' ? 'رابط الإحالة الخاص بك' : 'Your referral link'}</p><p className="mt-1 text-sm text-muted-foreground">{dir === 'rtl' ? 'احصل على 50 جنيه كاش باك بعد تأكيد واعتماد أول عملية شراء مدفوعة لصديقك.' : "Earn EGP 50 cashback after your friend's first paid purchase is confirmed and approved."}</p><p className="mt-1 text-sm text-muted-foreground">{dir === 'rtl' ? `عدد الإحالات: ${referral.referralCount}` : `${referral.referralCount} successful referrals`}</p><div className="mt-3 flex gap-2"><input readOnly value={`${window.location.origin}/ref/${referral.referralCode}`} className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 text-sm" /><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/ref/${referral.referralCode}`)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">{dir === 'rtl' ? 'نسخ' : 'Copy'}</button></div></div>}
        </section>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[20px] h-32 animate-pulse border border-black/[0.03]" />
            ))}
          </div>
        ) : orders?.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-black/[0.03] p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground mb-2">
              {dir === 'rtl' ? 'لا توجد طلبات' : 'No orders yet'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {dir === 'rtl' ? 'لم تقم بإجراء أي طلبات حتى الآن.' : 'You haven\'t placed any orders yet.'}
            </p>
            <Link href="/" className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all">
              {dir === 'rtl' ? 'تصفح الاشتراكات' : 'Browse Subscriptions'}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders?.map((order) => {
              const expanded = expandedOrders.has(order.id);
              return (
              <div key={order.id} className="bg-white rounded-[24px] border border-black/[0.03] shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleOrder(order.id)}
                  aria-expanded={expanded}
                className="w-full p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 text-start hover:bg-muted/10 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-display font-bold text-lg text-foreground">
                        {order.orderNumber}
                      </span>
                      <StatusBadge status={order.status} dir={dir} />
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {format(new Date(order.createdAt), 'MMM d, yyyy • h:mm a')}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-start md:text-end">
                      <div className="text-sm text-muted-foreground mb-1">
                        {dir === 'rtl' ? 'الإجمالي' : 'Total'}
                      </div>
                      <div className="font-display font-bold text-xl text-foreground">
                        {order.currency} {order.total}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {expanded && (
                  <>
                    <div className="p-6 border-t border-black/[0.03]">
                      <div className="space-y-4">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                              {item.coverImageUrl ? (
                                <img src={item.coverImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                                  <span className="text-white/50 font-bold">{item.productName.charAt(0)}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-foreground truncate">{item.productName}</h4>
                              <p className="text-sm text-muted-foreground">{item.duration}</p>
                            </div>
                            <div className="text-end">
                              <div className="font-medium text-foreground">
                                {order.currency} {item.lineTotal}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {dir === 'rtl' ? 'الكمية:' : 'Qty:'} {item.quantity}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-muted/20 border-t border-black/[0.03] flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {order.status === 'awaiting_payment' ? (
                          dir === 'rtl'
                            ? 'الرجاء إرسال إيصال الدفع عبر واتساب ليتم تفعيل طلبك.'
                            : 'Please send your payment proof via WhatsApp to activate your order.'
                        ) : order.status === 'payment_proof_received' ? (
                          dir === 'rtl'
                            ? 'تم استلام الإيصال، جارٍ التحقق وتفعيل الطلب.'
                            : 'Proof received, we are verifying and activating your order.'
                        ) : (
                          dir === 'rtl'
                            ? 'تواصل معنا عبر واتساب لأي استفسار.'
                            : 'Contact us on WhatsApp for any inquiries.'
                        )}
                      </div>
                      <a
                        href="https://wa.me/201229327902"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        {dir === 'rtl' ? 'دعم واتساب' : 'WhatsApp Support'}
                      </a>
                    </div>
                  </>
                )}
              </div>
              );
            })}
          </div>
        )}
        </div>
        </div>
      </div>
    </Layout>
  );
}

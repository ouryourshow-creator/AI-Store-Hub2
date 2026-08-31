import { useEffect, useState } from 'react';
import { CircleDollarSign, Link2, RefreshCw, Search, UsersRound } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

type ReferralItem = {
  id: number;
  referralCode: string;
  referrerName: string;
  referrerEmail: string;
  referredName: string;
  referredEmail: string;
  orderNumber: string | number;
  orderStatus: string;
  rewardStatus: string;
  rewardAmount: number;
  rewardCurrency: string;
  createdAt: string;
};

type ReferralResponse = {
  summary: {
    referredOrders: number;
    converted: number;
    pendingRewards: number;
    rewardedAmount: number;
  };
  items: ReferralItem[];
};

const orderStatusLabels: Record<string, [string, string]> = {
  awaiting_payment: ['في انتظار الدفع', 'Awaiting payment'],
  payment_proof_received: ['تم استلام الإيصال', 'Proof received'],
  confirmed: ['مؤكد', 'Confirmed'],
  fulfilled: ['مكتمل', 'Fulfilled'],
  cancelled: ['ملغى', 'Cancelled'],
};

function labelFor(value: string, rtl: boolean) {
  return orderStatusLabels[value]?.[rtl ? 0 : 1] ?? value;
}

export default function AdminReferrals() {
  const { dir } = useLang();
  const rtl = dir === 'rtl';
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ReferralResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async (query: string, signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('search', query.trim());
      const response = await fetch(`/api/admin/referrals?${params}`, { credentials: 'include', signal });
      if (!response.ok) throw new Error('Could not load referrals');
      setData(await response.json() as ReferralResponse);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(search, controller.signal), 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [search]);

  const summary = data?.summary ?? { referredOrders: 0, converted: 0, pendingRewards: 0, rewardedAmount: 0 };
  const cardClass = 'rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#102A43]">{rtl ? 'الإحالات' : 'Referrals'}</h1>
          <p className="mt-1 text-muted-foreground">{rtl ? 'تابع التحويلات والمكافآت من السجلات الفعلية.' : 'Track conversions and rewards from real customer records.'}</p>
        </div>
        <button onClick={() => void load(search)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" />{rtl ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric label={rtl ? 'الطلبات المُحالة' : 'Referred orders'} value={summary.referredOrders.toLocaleString()} icon={Link2} />
        <Metric label={rtl ? 'التحويلات الناجحة' : 'Converted referrals'} value={summary.converted.toLocaleString()} icon={UsersRound} />
        <Metric label={rtl ? 'مكافآت معلقة' : 'Pending rewards'} value={summary.pendingRewards.toLocaleString()} icon={CircleDollarSign} />
        <Metric label={rtl ? 'المكافآت المتاحة/المستخدمة' : 'Rewarded amount'} value={`EGP ${summary.rewardedAmount.toLocaleString()}`} icon={CircleDollarSign} />
      </div>

      <section className={cardClass}>
        <div className="relative max-w-md">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={rtl ? 'ابحث بالكود أو البريد أو الاسم' : 'Search code, email, or name'} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-10 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10" />
        </div>
      </section>

      {loading ? <LoadingRows /> : error ? <ErrorState rtl={rtl} onRetry={() => void load(search)} /> : data?.items.length === 0 ? <EmptyState rtl={rtl} /> : (
        <section className={`${cardClass} overflow-hidden p-0`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 text-start">{rtl ? 'المُحيل' : 'Referrer'}</th>
                  <th className="px-5 py-4 text-start">{rtl ? 'العميل المُحال' : 'Referred customer'}</th>
                  <th className="px-5 py-4 text-start">{rtl ? 'الطلب' : 'Order'}</th>
                  <th className="px-5 py-4 text-start">{rtl ? 'حالة الطلب' : 'Order status'}</th>
                  <th className="px-5 py-4 text-start">{rtl ? 'المكافأة' : 'Reward'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4"><p className="font-semibold">{item.referrerName}</p><p className="text-xs text-slate-500">{item.referrerEmail || item.referralCode}</p></td>
                    <td className="px-5 py-4"><p className="font-semibold">{item.referredName}</p><p className="text-xs text-slate-500">{item.referredEmail}</p></td>
                    <td className="px-5 py-4 font-mono text-xs">#{item.orderNumber}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.orderStatus === 'cancelled' ? 'bg-red-50 text-red-700' : item.orderStatus === 'confirmed' || item.orderStatus === 'fulfilled' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{labelFor(item.orderStatus, rtl)}</span></td>
                    <td className="px-5 py-4"><p className="font-semibold">{item.rewardAmount ? `${item.rewardCurrency} ${item.rewardAmount}` : '—'}</p><p className="text-xs text-slate-500">{item.rewardStatus === 'pending' ? (rtl ? 'في انتظار الاعتماد' : 'Pending approval') : item.rewardStatus === 'waiting' ? (rtl ? 'في انتظار أول شراء' : 'Waiting for first purchase') : item.rewardStatus === 'not_created' ? (rtl ? 'يحتاج تسوية' : 'Needs reconciliation') : item.rewardStatus}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Link2 }) {
  return <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-primary"><Icon className="h-5 w-5" /></div><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p></div>;
}

function LoadingRows() {
  return <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm"><div className="space-y-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div></div>;
}

function ErrorState({ rtl, onRetry }: { rtl: boolean; onRetry: () => void }) {
  return <div className="rounded-[20px] border border-red-100 bg-red-50 p-8 text-center text-red-700"><p className="font-semibold">{rtl ? 'تعذر تحميل الإحالات.' : 'Could not load referrals.'}</p><button onClick={onRetry} className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-bold shadow-sm">{rtl ? 'حاول مرة أخرى' : 'Try again'}</button></div>;
}

function EmptyState({ rtl }: { rtl: boolean }) {
  return <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-12 text-center"><Link2 className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-semibold">{rtl ? 'لا توجد إحالات بعد' : 'No referrals yet'}</p><p className="mt-1 text-sm text-slate-500">{rtl ? 'ستظهر هنا أول إحالة مرتبطة بطلب.' : 'The first referral-linked order will appear here.'}</p></div>;
}
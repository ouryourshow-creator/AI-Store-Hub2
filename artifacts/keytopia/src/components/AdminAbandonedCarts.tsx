import { useEffect, useState } from 'react';
import { CircleDollarSign, Clock3, RefreshCw, Search, ShoppingCart, UserRound } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

type CartItem = { productId: number; productName: string; duration: string; quantity: number; unitPrice: number; lineTotal: number };
type Cart = { id: number; visitorId: string; customerId: string | null; customerEmail: string | null; currency: string; total: number; itemCount: number; items: CartItem[]; status: string; recoveredOrderId: number | null; lastSeenAt: string; recoveredAt: string | null };
type CartResponse = { summary: { abandonedCount: number; abandonedTotal: { EGP: number; USD: number }; recoveredCount: number; inactivityMinutes: number }; items: Cart[] };

export default function AdminAbandonedCarts() {
  const { dir } = useLang();
  const rtl = dir === 'rtl';
  const [status, setStatus] = useState('abandoned');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ status });
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`/api/admin/abandoned-carts?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Could not load carts');
      setData(await response.json() as CartResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [status, search]);

  const summary = data?.summary ?? { abandonedCount: 0, abandonedTotal: { EGP: 0, USD: 0 }, recoveredCount: 0, inactivityMinutes: 30 };
  const cardClass = 'rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm';
  const statusLabel = (value: string) => value === 'recovered' ? (rtl ? 'مستردة' : 'Recovered') : value === 'active' ? (rtl ? 'نشطة' : 'Active') : (rtl ? 'متروكة' : 'Abandoned');

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 className="font-display text-3xl font-bold">{rtl ? 'السلات المتروكة' : 'Abandoned carts'}</h1><p className="mt-1 text-muted-foreground">{rtl ? `السلة تعتبر متروكة بعد ${summary.inactivityMinutes} دقيقة من عدم النشاط.` : `A cart is abandoned after ${summary.inactivityMinutes} minutes without activity.`}</p></div><button onClick={() => void load()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold hover:bg-slate-50"><RefreshCw className="h-4 w-4" />{rtl ? 'تحديث' : 'Refresh'}</button></div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4"><Metric label={rtl ? 'السلات المتروكة' : 'Abandoned carts'} value={summary.abandonedCount.toLocaleString()} icon={ShoppingCart} /><Metric label="EGP" value={`EGP ${summary.abandonedTotal.EGP.toLocaleString()}`} icon={CircleDollarSign} /><Metric label="USD" value={`USD ${summary.abandonedTotal.USD.toLocaleString()}`} icon={CircleDollarSign} /><Metric label={rtl ? 'تم استردادها' : 'Recovered'} value={summary.recoveredCount.toLocaleString()} icon={RefreshCw} /></div>
    <section className={cardClass}><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={rtl ? 'ابحث بالبريد أو معرف الزائر' : 'Search email or visitor ID'} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-10 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-primary">{[['abandoned', rtl ? 'المتروكة' : 'Abandoned'], ['active', rtl ? 'النشطة' : 'Active'], ['recovered', rtl ? 'المستردة' : 'Recovered'], ['all', rtl ? 'الكل' : 'All']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></section>
    {loading ? <LoadingRows /> : error ? <div className="rounded-[20px] border border-red-100 bg-red-50 p-8 text-center text-red-700"><p className="font-semibold">{rtl ? 'تعذر تحميل السلات.' : 'Could not load carts.'}</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-bold shadow-sm">{rtl ? 'حاول مرة أخرى' : 'Try again'}</button></div> : data?.items.length === 0 ? <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-12 text-center"><ShoppingCart className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-semibold">{rtl ? 'لا توجد سلات في هذا الفلتر' : 'No carts match this filter'}</p><p className="mt-1 text-sm text-slate-500">{rtl ? 'سيتم تسجيل السلات بعد إضافة منتج وتركه دون إكمال الطلب.' : 'Carts appear after a product is added and left without completing checkout.'}</p></div> : <section className={`${cardClass} overflow-hidden p-0`}><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4 text-start">{rtl ? 'العميل' : 'Customer'}</th><th className="px-5 py-4 text-start">{rtl ? 'المنتجات' : 'Items'}</th><th className="px-5 py-4 text-start">{rtl ? 'القيمة' : 'Value'}</th><th className="px-5 py-4 text-start">{rtl ? 'آخر نشاط' : 'Last activity'}</th><th className="px-5 py-4 text-start">{rtl ? 'الحالة' : 'Status'}</th></tr></thead><tbody className="divide-y divide-slate-100">{data?.items.map((cart) => <tr key={cart.id} className="hover:bg-slate-50/80"><td className="px-5 py-4"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-slate-400" /><div><p className="font-semibold">{cart.customerEmail || (rtl ? 'زائر' : 'Visitor')}</p><p className="max-w-[220px] truncate text-xs text-slate-500">{cart.customerId ? (rtl ? 'حساب مسجل' : 'Signed-in customer') : cart.visitorId}</p></div></div></td><td className="px-5 py-4"><p className="font-semibold">{cart.items[0]?.productName || '—'}</p><p className="text-xs text-slate-500">{cart.itemCount} {rtl ? 'عنصر' : cart.itemCount === 1 ? 'item' : 'items'}{cart.items.length > 1 ? ` · +${cart.items.length - 1}` : ''}</p></td><td className="px-5 py-4 font-bold">{cart.currency} {cart.total.toLocaleString()}</td><td className="px-5 py-4"><div className="flex items-center gap-2 text-slate-600"><Clock3 className="h-4 w-4" /><span dir="ltr">{new Date(cart.lastSeenAt).toLocaleString()}</span></div></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cart.status === 'recovered' ? 'bg-emerald-50 text-emerald-700' : cart.status === 'active' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{statusLabel(cart.status)}</span></td></tr>)}</tbody></table></div></section>}
  </div>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ShoppingCart }) {
  return <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-primary"><Icon className="h-5 w-5" /></div><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p></div>;
}

function LoadingRows() {
  return <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm"><div className="space-y-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div></div>;
}
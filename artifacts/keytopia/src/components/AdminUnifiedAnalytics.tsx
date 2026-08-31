import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, Eye, ShoppingBag, TrendingUp } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import { getGetAdminSalesAnalyticsQueryKey, getGetAdminVisitsAnalyticsQueryKey, useGetAdminSalesAnalytics, useGetAdminVisitsAnalytics, type AnalyticsPresetParameter, type GetAdminSalesAnalyticsParams, type GetAdminVisitsAnalyticsParams } from '@workspace/api-client-react';

const presets: Array<{ value: AnalyticsPresetParameter; en: string; ar: string }> = [
  { value: 'today', en: 'Today', ar: 'اليوم' },
  { value: 'yesterday', en: 'Yesterday', ar: 'أمس' },
  { value: 'last_week', en: 'Last week', ar: 'الأسبوع الماضي' },
  { value: 'last_month', en: 'Last month', ar: 'آخر شهر' },
  { value: 'last_3_months', en: 'Last 3 months', ar: 'آخر 3 أشهر' },
  { value: 'last_6_months', en: 'Last 6 months', ar: 'آخر 6 أشهر' },
  { value: 'year', en: 'Year', ar: 'السنة الماضية' },
  { value: 'custom', en: 'Custom range', ar: 'نطاق مخصص' },
];

export default function AdminUnifiedAnalytics() {
  const { dir } = useLang();
  const rtl = dir === 'rtl';
  const [preset, setPreset] = useState<AnalyticsPresetParameter>('last_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const custom = preset === 'custom';
  const ready = !custom || Boolean(startDate && endDate);
  const valid = !custom || !startDate || !endDate || startDate <= endDate;
  const params = custom ? { preset, startDate: startDate || undefined, endDate: endDate || undefined } : { preset };
  const visitsParams = params as GetAdminVisitsAnalyticsParams;
  const salesParams = params as GetAdminSalesAnalyticsParams;
  const visits = useGetAdminVisitsAnalytics(visitsParams, { query: { enabled: ready && valid, queryKey: getGetAdminVisitsAnalyticsQueryKey(visitsParams) } });
  const sales = useGetAdminSalesAnalytics(salesParams, { query: { enabled: ready && valid, queryKey: getGetAdminSalesAnalyticsQueryKey(salesParams) } });
  const loading = visits.isLoading || sales.isLoading;
  const error = visits.isError || sales.isError;
  const visitData = visits.data;
  const salesData = sales.data;
  const trends = Array.from(new Set([...(visitData?.trends ?? []).map((item) => item.date), ...(salesData?.trends ?? []).map((item) => item.date)])).sort().map((date) => {
    const visit = visitData?.trends.find((item) => item.date === date);
    const sale = salesData?.trends.find((item) => item.date === date);
    return { date, visits: visit?.visits ?? 0, orders: sale?.orders ?? 0, sales: sale?.sales ?? 0, salesUsd: sale?.salesUsd ?? 0 };
  });
  const conversion = visitData?.totalVisits ? ((salesData?.totalOrders ?? 0) / visitData.totalVisits) * 100 : 0;
  const range = visitData?.range ?? salesData?.range;

  return <div className="space-y-6">
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><h1 className="font-display text-3xl font-bold">{rtl ? 'التحليلات الموحدة' : 'Unified analytics'}</h1><p className="mt-1 text-muted-foreground">{rtl ? 'صورة واحدة للزيارات والمبيعات والعملاء.' : 'One view of traffic, sales, and conversion.'}</p></div>{range && <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500"><CalendarDays className="h-4 w-4 text-primary" /><span dir="ltr">{range.startDate} — {range.endDate}</span></div>}</div>
    <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"><div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]"><label><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{rtl ? 'الفترة' : 'Period'}</span><select value={preset} onChange={(event) => setPreset(event.target.value as AnalyticsPresetParameter)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-primary">{presets.map((option) => <option key={option.value} value={option.value}>{rtl ? option.ar : option.en}</option>)}</select></label>{custom && <><label><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{rtl ? 'من' : 'From'}</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary" /></label><label><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{rtl ? 'إلى' : 'To'}</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary" /></label></>}</div>{!valid && <p className="mt-3 text-sm font-semibold text-red-600">{rtl ? 'يجب أن يكون تاريخ النهاية بعد البداية.' : 'The end date must be on or after the start date.'}</p>}{custom && !ready && <p className="mt-3 text-sm font-semibold text-amber-600">{rtl ? 'اختر تاريخ البداية والنهاية.' : 'Choose both dates.'}</p>}</section>
    {loading ? <Loading /> : error || !visitData || !salesData ? <div className="rounded-[20px] border border-red-100 bg-red-50 p-8 text-center text-red-700"><p className="font-semibold">{rtl ? 'تعذر تحميل التحليلات.' : 'Could not load analytics.'}</p><p className="mt-1 text-sm">{rtl ? 'حاول مرة أخرى بعد قليل.' : 'Please try again in a moment.'}</p></div> : <><div className="grid grid-cols-1 gap-4 md:grid-cols-4"><Metric label={rtl ? 'الزيارات' : 'Visits'} value={visitData.totalVisits.toLocaleString()} icon={Eye} /><Metric label={rtl ? 'الطلبات المكتملة' : 'Completed orders'} value={salesData.totalOrders.toLocaleString()} icon={ShoppingBag} /><Metric label={rtl ? 'المبيعات بالجنيه' : 'Sales (EGP)'} value={`EGP ${salesData.totalSales.toLocaleString()}`} icon={TrendingUp} /><Metric label={rtl ? 'معدل التحويل' : 'Conversion rate'} value={`${conversion.toFixed(2)}%`} icon={TrendingUp} /></div><section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-5 font-display text-base font-bold">{rtl ? 'الزيارات والطلبات يومياً' : 'Daily visits and orders'}</h2>{trends.length === 0 ? <div className="grid h-[320px] place-items-center text-sm text-slate-500">{rtl ? 'لا توجد بيانات في هذه الفترة.' : 'No data for this period.'}</div> : <div className="h-[320px]" dir="ltr"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="unifiedVisits" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis yAxisId="left" axisLine={false} tickLine={false} allowDecimals={false} /><YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }} /><Area yAxisId="left" type="monotone" dataKey="visits" name={rtl ? 'الزيارات' : 'Visits'} stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#unifiedVisits)" /><Area yAxisId="right" type="monotone" dataKey="orders" name={rtl ? 'الطلبات' : 'Orders'} stroke="hsl(var(--accent))" strokeWidth={3} fill="none" /></AreaChart></ResponsiveContainer></div>}</section></>}
  </div>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Eye }) {
  return <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-primary"><Icon className="h-5 w-5" /></div><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p></div>;
}

function Loading() {
  return <div className="space-y-5"><div className="grid grid-cols-1 gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-[20px] bg-white" />)}</div><div className="h-[370px] animate-pulse rounded-[20px] bg-white" /></div>;
}
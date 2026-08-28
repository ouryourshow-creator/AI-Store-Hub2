import { useState, type ReactNode } from 'react';
import {
  getGetAdminSalesAnalyticsQueryKey,
  getGetAdminVisitsAnalyticsQueryKey,
  useGetAdminSalesAnalytics,
  useGetAdminVisitsAnalytics,
  type AnalyticsPresetParameter,
  type GetAdminSalesAnalyticsParams,
  type GetAdminVisitsAnalyticsParams,
  type SalesAnalytics,
  type VisitsAnalytics,
} from '@workspace/api-client-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, DollarSign, Eye, MapPin, ShoppingBag, type LucideIcon } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import { getCountryName } from '../lib/countryNames';

type AnalyticsKind = 'visits' | 'sales';

const presets: Array<{ value: AnalyticsPresetParameter; en: string; ar: string }> = [
  { value: 'today', en: 'Today', ar: 'اليوم' },
  { value: 'yesterday', en: 'Yesterday', ar: 'أمس' },
  { value: 'last_week', en: 'Last week', ar: 'الأسبوع الماضي' },
  { value: 'last_2_weeks', en: 'Last 2 weeks', ar: 'آخر أسبوعين' },
  { value: 'last_month', en: 'Last month', ar: 'آخر شهر' },
  { value: 'last_3_months', en: 'Last 3 months', ar: 'آخر 3 أشهر' },
  { value: 'last_6_months', en: 'Last 6 months', ar: 'آخر 6 أشهر' },
  { value: 'year', en: 'Year', ar: 'السنة الماضية' },
  { value: 'custom', en: 'Custom range', ar: 'نطاق مخصص' },
];

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="bg-white p-5 rounded-[20px] border border-black/[0.03] shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-sm font-semibold text-muted-foreground mb-1">{label}</p>
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export default function AdminAnalytics({ kind }: { kind: AnalyticsKind }) {
  const { dir } = useLang();
  const [preset, setPreset] = useState<AnalyticsPresetParameter>('last_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const customRange = preset === 'custom';
  const datesReady = !customRange || (Boolean(startDate) && Boolean(endDate));
  const invalidRange = customRange && Boolean(startDate && endDate && startDate > endDate);
  const validationMessage = invalidRange
    ? (dir === 'rtl' ? 'يجب أن يكون تاريخ النهاية في أو بعد تاريخ البداية.' : 'The end date must be on or after the start date.')
    : customRange && !datesReady
      ? (dir === 'rtl' ? 'اختر تاريخ البداية والنهاية.' : 'Choose both a start and end date.')
      : null;

  const visitsParams: GetAdminVisitsAnalyticsParams = customRange
    ? { preset, startDate: startDate || undefined, endDate: endDate || undefined }
    : { preset };
  const salesParams: GetAdminSalesAnalyticsParams = customRange
    ? { preset, startDate: startDate || undefined, endDate: endDate || undefined }
    : { preset };
  const visitsQuery = useGetAdminVisitsAnalytics(visitsParams, {
    query: {
      enabled: kind === 'visits' && datesReady && !invalidRange,
      queryKey: getGetAdminVisitsAnalyticsQueryKey(visitsParams),
    },
  });
  const salesQuery = useGetAdminSalesAnalytics(salesParams, {
    query: {
      enabled: kind === 'sales' && datesReady && !invalidRange,
      queryKey: getGetAdminSalesAnalyticsQueryKey(salesParams),
    },
  });

  const activeQuery = kind === 'visits' ? visitsQuery : salesQuery;
  const data = activeQuery.data;
  const title = kind === 'visits'
    ? (dir === 'rtl' ? 'الزيارات' : 'Visits')
    : (dir === 'rtl' ? 'المبيعات' : 'Sales');
  const subtitle = kind === 'visits'
    ? (dir === 'rtl' ? 'تابع الزيارات حسب الفترة والبلد.' : 'Track visits by date range and country.')
    : (dir === 'rtl' ? 'المبيعات المؤكدة والمكتملة فقط، مع فصل العملات.' : 'Confirmed and fulfilled sales only, with currencies kept separate.');

  const rangeLabel = data
    ? `${data.range.startDate} — ${data.range.endDate}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {rangeLabel && (
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-white border border-black/[0.04] rounded-full px-4 py-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span dir="ltr">{rangeLabel}</span>
          </div>
        )}
      </div>

      <section className="bg-white rounded-[20px] border border-black/[0.03] shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto] gap-4 items-end">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {dir === 'rtl' ? 'الفترة' : 'Period'}
            </span>
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value as AnalyticsPresetParameter)}
              className="w-full bg-muted rounded-xl border-0 px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
            >
              {presets.map((option) => (
                <option key={option.value} value={option.value}>
                  {dir === 'rtl' ? option.ar : option.en}
                </option>
              ))}
            </select>
          </label>
          {customRange && (
            <>
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {dir === 'rtl' ? 'من' : 'From'}
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full bg-muted rounded-xl border-0 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {dir === 'rtl' ? 'إلى' : 'To'}
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full bg-muted rounded-xl border-0 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </>
          )}
        </div>
        {validationMessage && <p className="mt-3 text-sm text-destructive font-medium">{validationMessage}</p>}
      </section>

      {validationMessage ? null : activeQuery.isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((item) => <div key={item} className="h-32 bg-white rounded-[20px] animate-pulse border border-black/[0.03]" />)}
          </div>
          <div className="h-[340px] bg-white rounded-[20px] animate-pulse border border-black/[0.03]" />
        </div>
      ) : activeQuery.isError || !data ? (
        <div className="bg-red-50 text-red-700 p-6 rounded-[20px] border border-red-100 text-center">
          <p className="font-semibold">{dir === 'rtl' ? 'تعذر تحميل التقرير.' : 'Could not load this report.'}</p>
          <p className="text-sm mt-1">{dir === 'rtl' ? 'حاول مرة أخرى بعد قليل.' : 'Please try again in a moment.'}</p>
        </div>
      ) : kind === 'visits' ? (
        <VisitsReport data={visitsQuery.data!} dir={dir} />
      ) : (
        <SalesReport data={salesQuery.data!} dir={dir} />
      )}
    </div>
  );
}

function VisitsReport({ data, dir }: { data: VisitsAnalytics; dir: 'rtl' | 'ltr' }) {
  const isEmpty = data.totalVisits === 0;
  const countries = data.countries.map((item) => ({
    ...item,
    country: getCountryName(item.country, dir),
  }));
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <StatCard label={dir === 'rtl' ? 'إجمالي الزيارات' : 'Total visits'} value={data.totalVisits.toLocaleString()} icon={Eye} />
        <StatCard label={dir === 'rtl' ? 'البلدان المسجلة' : 'Countries reached'} value={data.countries.length.toLocaleString()} icon={MapPin} />
      </div>
      {isEmpty ? <EmptyReport dir={dir} /> : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <ReportCard className="lg:col-span-3" title={dir === 'rtl' ? 'الزيارات اليومية' : 'Daily visits'}>
            <div className="h-[310px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trends} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
                  <defs><linearGradient id="visitsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="visits" name={dir === 'rtl' ? 'الزيارات' : 'Visits'} stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#visitsGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ReportCard>
          <ReportCard className="lg:col-span-2" title={dir === 'rtl' ? 'أكثر البلدان زيارة' : 'Top countries'}>
            <div className="h-[310px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countries} layout="vertical" margin={{ top: 8, right: 12, left: 24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="country" width={50} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="visits" name={dir === 'rtl' ? 'الزيارات' : 'Visits'} fill="hsl(var(--accent))" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ReportCard>
        </div>
      )}
    </>
  );
}

function SalesReport({ data, dir }: { data: SalesAnalytics; dir: 'rtl' | 'ltr' }) {
  const isEmpty = data.totalOrders === 0;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label={dir === 'rtl' ? 'المبيعات بالجنيه' : 'Sales (EGP)'} value={`EGP ${data.totalSales.toLocaleString()}`} icon={DollarSign} />
        <StatCard label={dir === 'rtl' ? 'المبيعات بالدولار' : 'Sales (USD)'} value={`USD ${data.totalSalesUsd.toLocaleString()}`} icon={DollarSign} />
        <StatCard label={dir === 'rtl' ? 'الطلبات المكتملة' : 'Completed orders'} value={data.totalOrders.toLocaleString()} icon={ShoppingBag} />
      </div>
      {isEmpty ? <EmptyReport dir={dir} /> : (
        <ReportCard title={dir === 'rtl' ? 'المبيعات اليومية حسب العملة' : 'Daily sales by currency'}>
          <div className="h-[340px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="egpGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient>
                  <linearGradient id="usdGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.24} /><stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="egp" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="usd" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }} />
                <Area yAxisId="egp" type="monotone" dataKey="sales" name="EGP" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#egpGradient)" />
                <Area yAxisId="usd" type="monotone" dataKey="salesUsd" name="USD" stroke="hsl(var(--accent))" strokeWidth={3} fill="url(#usdGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>
      )}
    </>
  );
}

function ReportCard({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-[20px] border border-black/[0.03] shadow-sm p-5 ${className}`}>
      <h2 className="text-base font-display font-bold mb-5">{title}</h2>
      {children}
    </section>
  );
}

function EmptyReport({ dir }: { dir: 'rtl' | 'ltr' }) {
  return (
    <div className="bg-white rounded-[20px] border border-black/[0.03] shadow-sm p-14 text-center text-muted-foreground">
      <CalendarDays className="w-10 h-10 mx-auto mb-4 text-primary/30" />
      <p className="font-semibold text-foreground">{dir === 'rtl' ? 'لا توجد بيانات لهذه الفترة' : 'No data for this period'}</p>
      <p className="text-sm mt-1">{dir === 'rtl' ? 'اختر فترة أخرى أو انتظر وصول بيانات جديدة.' : 'Try another range or check back after new activity arrives.'}</p>
    </div>
  );
}
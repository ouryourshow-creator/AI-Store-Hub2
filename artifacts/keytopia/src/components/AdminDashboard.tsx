import { useState } from 'react';
import {
  useGetAdminDashboard,
  getGetAdminDashboardQueryKey,
  type AnalyticsPresetParameter,
  type GetAdminDashboardParams,
} from '@workspace/api-client-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { DollarSign, ShoppingBag, Eye, MapPin, Package, Activity, CalendarDays, type LucideIcon } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import { getCountryName } from '../lib/countryNames';

const dashboardPresets: Array<{ value: AnalyticsPresetParameter; en: string; ar: string }> = [
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

export default function AdminDashboard() {
  const { dir } = useLang();
  const [preset, setPreset] = useState<AnalyticsPresetParameter>('last_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const customRange = preset === 'custom';
  const datesReady = !customRange || (Boolean(startDate) && Boolean(endDate));
  const invalidRange = customRange && Boolean(startDate && endDate && startDate > endDate);
  const params: GetAdminDashboardParams = customRange
    ? { preset, startDate: startDate || undefined, endDate: endDate || undefined }
    : { preset };
  const { data: dashboard, isLoading, error } = useGetAdminDashboard(params, {
    query: {
      enabled: datesReady && !invalidRange,
      queryKey: getGetAdminDashboardQueryKey(params),
    }
  });

  const validationMessage = invalidRange
    ? (dir === 'rtl' ? 'يجب أن يكون تاريخ النهاية في أو بعد تاريخ البداية.' : 'The end date must be on or after the start date.')
    : customRange && !datesReady
      ? (dir === 'rtl' ? 'اختر تاريخ البداية والنهاية.' : 'Choose both a start and end date.')
      : null;

  if (validationMessage) {
    return (
      <div className="space-y-6">
        <DashboardDateFilter
          dir={dir}
          preset={preset}
          setPreset={setPreset}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm font-medium text-amber-800">
          {validationMessage}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <DashboardDateFilter
          dir={dir}
          preset={preset}
          setPreset={setPreset}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-6 rounded-[24px] h-32 animate-pulse border border-black/[0.03]" />
          ))}
        </div>
        <div className="bg-white rounded-[24px] h-[400px] animate-pulse border border-black/[0.03]" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="space-y-6">
        <DashboardDateFilter
          dir={dir}
          preset={preset}
          setPreset={setPreset}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />
        <div className="flex items-center justify-center rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-red-600">
          <div>
            <h3 className="mb-1 text-lg font-semibold">{dir === 'rtl' ? 'حدث خطأ' : 'Error loading dashboard'}</h3>
            <p className="text-sm opacity-80">{dir === 'rtl' ? 'تعذر تحميل الإحصائيات' : 'Could not load statistics'}</p>
          </div>
        </div>
      </div>
    );
  }

  const countries = dashboard.countries.slice(0, 5).map((item) => ({
    ...item,
    country: getCountryName(item.country, dir),
  }));

  const StatCard = ({ title, value, icon: Icon, detail }: { title: string; value: string; icon: LucideIcon; detail: string }) => (
    <div className="flex min-h-[156px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {dir === 'rtl' ? 'حالي' : 'Current'}
        </span>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="truncate text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{detail}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <DashboardDateFilter
        dir={dir}
        preset={preset}
        setPreset={setPreset}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title={dir === 'rtl' ? 'إجمالي المبيعات' : 'Total Sales'}
          value={`EGP ${dashboard.totalSales.toLocaleString()} · USD ${dashboard.totalSalesUsd.toLocaleString()}`}
          icon={DollarSign}
          detail={dir === 'rtl' ? 'الطلبات المؤكدة والمكتملة' : 'Confirmed and fulfilled orders'}
        />
        <StatCard
          title={dir === 'rtl' ? 'إجمالي الطلبات' : 'Total Orders'}
          value={dashboard.totalOrders.toLocaleString()}
          icon={ShoppingBag}
          detail={dir === 'rtl' ? 'كل حالات الطلبات المسجلة' : 'All recorded order statuses'}
        />
        <StatCard
          title={dir === 'rtl' ? 'إجمالي الزيارات' : 'Total Visits'}
          value={dashboard.totalVisits.toLocaleString()}
          icon={Eye}
          detail={dir === 'rtl' ? 'الزيارات المسجلة في التحليلات' : 'Visits recorded in analytics'}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Activity className="h-4 w-4 text-primary" />
              {dir === 'rtl' ? 'المبيعات والطلبات خلال آخر 30 يوماً' : 'Sales & orders · last 30 days'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {dir === 'rtl' ? 'البيانات اليومية مبنية على وقت إنشاء الطلب.' : 'Daily data is grouped by order creation time.'}
            </p>
          </div>
          <span className="w-fit rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            {dir === 'rtl' ? 'المبيعات بالجنيه المصري' : 'Sales shown in EGP'}
          </span>
        </div>
        {dashboard.trends.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center px-6 text-center text-sm text-slate-500">
            {dir === 'rtl' ? 'لا توجد بيانات يومية لهذه الفترة.' : 'No daily activity is available for this period.'}
          </div>
        ) : (
          <div className="h-[320px] w-full p-4 sm:p-6" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard.trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(15,23,42,0.1)' }}
                  cursor={{ stroke: 'rgba(15,23,42,0.15)', strokeWidth: 2 }}
                />
                <Area yAxisId="left" type="monotone" dataKey="sales" name={dir === 'rtl' ? 'المبيعات' : 'Sales'} stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                <Area yAxisId="right" type="monotone" dataKey="orders" name={dir === 'rtl' ? 'الطلبات' : 'Orders'} stroke="hsl(var(--accent))" strokeWidth={3} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Package className="h-4 w-4 text-primary" />
              {dir === 'rtl' ? 'المنتجات الأكثر ظهوراً' : 'Most viewed products'}
            </h2>
            <span className="text-xs text-slate-400">{dir === 'rtl' ? 'حسب المشاهدات' : 'By views'}</span>
          </div>
          <div className="space-y-2.5">
            {dashboard.popularProducts.slice(0, 5).map((product, i) => (
              <div key={product.productId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-500 shadow-sm">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-800">{product.productName}</h3>
                    <p className="text-xs text-slate-500">{product.views.toLocaleString()} {dir === 'rtl' ? 'مشاهدة' : 'views'}</p>
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <div className="text-sm font-bold text-emerald-600">{product.sold.toLocaleString()}</div>
                  <div className="text-[11px] text-slate-400">{dir === 'rtl' ? 'مباع' : 'sold'}</div>
                </div>
              </div>
            ))}
            {dashboard.popularProducts.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-500">
                {dir === 'rtl' ? 'لا توجد بيانات للمنتجات.' : 'No product activity is available.'}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <MapPin className="h-4 w-4 text-primary" />
              {dir === 'rtl' ? 'الزيارات حسب البلد' : 'Visits by country'}
            </h2>
            <span className="text-xs text-slate-400">{dir === 'rtl' ? 'أعلى 5' : 'Top 5'}</span>
          </div>
          {countries.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-500">
              {dir === 'rtl' ? 'لا توجد بيانات للبلدان.' : 'No country activity is available.'}
            </div>
          ) : (
            <div className="h-[260px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countries} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="rgba(15,23,42,0.08)" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis dataKey="country" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#0f172a', fontWeight: 600 }} />
                  <Tooltip cursor={{ fill: 'rgba(15,23,42,0.03)' }} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(15,23,42,0.1)' }} />
                  <Bar dataKey="visits" name={dir === 'rtl' ? 'الزيارات' : 'Visits'} fill="hsl(var(--primary))" radius={[0, 5, 5, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DashboardDateFilter({
  dir,
  preset,
  setPreset,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: {
  dir: 'rtl' | 'ltr';
  preset: AnalyticsPresetParameter;
  setPreset: (value: AnalyticsPresetParameter) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex flex-col gap-3 ${preset === 'custom' ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_auto_auto]' : 'sm:flex-row sm:items-end sm:justify-between'}`}>
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {dir === 'rtl' ? 'الفترة' : 'Reporting period'}
          </span>
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value as AnalyticsPresetParameter)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
          >
            {dashboardPresets.map((option) => (
              <option key={option.value} value={option.value}>{dir === 'rtl' ? option.ar : option.en}</option>
            ))}
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{dir === 'rtl' ? 'من' : 'From'}</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{dir === 'rtl' ? 'إلى' : 'To'}</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
              />
            </label>
          </>
        )}
        {preset !== 'custom' && (
          <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex">
            <CalendarDays className="h-4 w-4 text-primary" />
            {dir === 'rtl' ? 'كل أرقام هذه الصفحة للفترة المختارة' : 'All metrics reflect the selected period'}
          </div>
        )}
      </div>
    </section>
  );
}

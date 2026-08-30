import { useMemo, useState } from 'react';
import { CalendarDays, Download, FileSpreadsheet, ShoppingCart } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

type Preset = 'today' | 'yesterday' | 'last_week' | 'last_month' | 'year' | 'custom';

const presets: Array<{ value: Preset; en: string; ar: string }> = [
  { value: 'today', en: 'Today', ar: 'اليوم' },
  { value: 'yesterday', en: 'Yesterday', ar: 'أمس' },
  { value: 'last_week', en: 'Last week', ar: 'الأسبوع الماضي' },
  { value: 'last_month', en: 'Last month', ar: 'آخر شهر' },
  { value: 'year', en: 'This year', ar: 'هذه السنة' },
  { value: 'custom', en: 'Custom range', ar: 'نطاق مخصص' },
];

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Exclude<Preset, 'custom'>) {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);
  if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (preset === 'last_week') {
    start.setDate(start.getDate() - 6);
  } else if (preset === 'last_month') {
    start.setMonth(start.getMonth() - 1);
  } else if (preset === 'year') {
    start.setMonth(0, 1);
  }
  return { startDate: dateValue(start), endDate: dateValue(end) };
}

export default function AdminReports() {
  const { dir } = useLang();
  const initialRange = useMemo(() => rangeForPreset('last_month'), []);
  const [preset, setPreset] = useState<Preset>('last_month');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const invalidRange = !startDate || !endDate || startDate > endDate;
  const query = invalidRange ? '' : `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  const selectPreset = (next: Preset) => {
    setPreset(next);
    if (next !== 'custom') {
      const range = rangeForPreset(next);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{dir === 'rtl' ? 'التقارير' : 'Reports'}</h1>
        <p className="mt-1 text-muted-foreground">
          {dir === 'rtl' ? 'نزّل ملفات متوافقة مع Excel من بيانات المتجر الحقيقية.' : 'Download Excel-compatible files from real store data.'}
        </p>
      </div>

      <section className="rounded-[20px] border border-black/[0.03] bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dir === 'rtl' ? 'الفترة' : 'Period'}</span>
            <select
              value={preset}
              onChange={(event) => selectPreset(event.target.value as Preset)}
              className="w-full rounded-xl border-0 bg-muted px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
            >
              {presets.map((option) => <option key={option.value} value={option.value}>{dir === 'rtl' ? option.ar : option.en}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dir === 'rtl' ? 'من' : 'From'}</span>
            <input type="date" value={startDate} onChange={(event) => { setPreset('custom'); setStartDate(event.target.value); }} className="w-full rounded-xl border-0 bg-muted px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dir === 'rtl' ? 'إلى' : 'To'}</span>
            <input type="date" value={endDate} onChange={(event) => { setPreset('custom'); setEndDate(event.target.value); }} className="w-full rounded-xl border-0 bg-muted px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </label>
        </div>
        {invalidRange && <p className="mt-3 text-sm font-medium text-destructive">{dir === 'rtl' ? 'اختر نطاقاً صحيحاً.' : 'Choose a valid date range.'}</p>}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ExportCard
          icon={ShoppingCart}
          title={dir === 'rtl' ? 'تصدير الطلبات' : 'Orders export'}
          description={dir === 'rtl' ? 'كل الطلبات وتفاصيل العملاء والمنتجات والحالة.' : 'Every order with customer, product, payment, and status details.'}
          href={query ? `/api/admin/reports/orders.csv?${query}` : undefined}
          label={dir === 'rtl' ? 'تنزيل ملف الطلبات' : 'Download orders CSV'}
          dir={dir}
        />
        <ExportCard
          icon={FileSpreadsheet}
          title={dir === 'rtl' ? 'ملخص المبيعات' : 'Sales summary'}
          description={dir === 'rtl' ? 'المبيعات المكتملة يومياً مع فصل الجنيه والدولار.' : 'Daily completed sales with EGP and USD separated.'}
          href={query ? `/api/admin/reports/sales.csv?${query}` : undefined}
          label={dir === 'rtl' ? 'تنزيل ملخص المبيعات' : 'Download sales CSV'}
          dir={dir}
        />
      </div>
    </div>
  );
}

function ExportCard({
  icon: Icon,
  title,
  description,
  href,
  label,
  dir,
}: {
  icon: typeof ShoppingCart;
  title: string;
  description: string;
  href?: string;
  label: string;
  dir: 'rtl' | 'ltr';
}) {
  return (
    <section className="rounded-[20px] border border-black/[0.03] bg-white p-6 shadow-sm">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{description}</p>
      {href ? (
        <a href={href} download className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90">
          <Download className="h-4 w-4" />{label}
        </a>
      ) : (
        <span className="mt-5 inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500">
          <CalendarDays className="h-4 w-4" />{dir === 'rtl' ? 'اختر التواريخ أولاً' : 'Choose dates first'}
        </span>
      )}
    </section>
  );
}
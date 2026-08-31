import { useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

const reportOptions = [
  { type: 'orders', en: 'Orders report', ar: 'تقرير الطلبات', descriptionEn: 'Orders, customers, status, discounts, and totals.', descriptionAr: 'الطلبات والعملاء والحالة والخصومات والإجماليات.' },
  { type: 'referrals', en: 'Referrals report', ar: 'تقرير الإحالات', descriptionEn: 'Referral codes, referred customers, and reward status.', descriptionAr: 'أكواد الإحالة والعملاء وحالة المكافآت.' },
  { type: 'abandoned', en: 'Abandoned carts', ar: 'السلات المتروكة', descriptionEn: 'Cart value, items, identity, and recovery status.', descriptionAr: 'قيمة السلة والعناصر والهوية وحالة الاسترداد.' },
  { type: 'products', en: 'Product performance', ar: 'أداء المنتجات', descriptionEn: 'Published state, availability, and sold counts.', descriptionAr: 'حالة النشر والتوفر وعدد المبيعات.' },
];

export default function AdminReports() {
  const { dir } = useLang();
  const rtl = dir === 'rtl';
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const download = async (type: string) => {
    if (startDate && endDate && startDate > endDate) {
      setError(true);
      return;
    }
    setActive(type);
    setDownloaded(null);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const response = await fetch(`/api/admin/reports/${type}?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Report failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `keytopia-${type}-report.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setDownloaded(type);
    } catch {
      setError(true);
    } finally {
      setActive(null);
    }
  };

  return <div className="space-y-6">
    <div><h1 className="font-display text-3xl font-bold">{rtl ? 'التقارير' : 'Reports'}</h1><p className="mt-1 text-muted-foreground">{rtl ? 'نزّل ملفات Excel حقيقية من السجلات الحالية مع احترام الفترة المحددة.' : 'Download real Excel workbooks from current records for the selected period.'}</p></div>
    <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><label><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{rtl ? 'من (اختياري)' : 'From (optional)'}</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary" /></label><label><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{rtl ? 'إلى (اختياري)' : 'To (optional)'}</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary" /></label></div>{error && <p className="mt-3 text-sm font-semibold text-red-600">{startDate && endDate && startDate > endDate ? (rtl ? 'يجب أن يكون تاريخ النهاية بعد البداية.' : 'The end date must be on or after the start date.') : (rtl ? 'تعذر إنشاء التقرير. حاول مرة أخرى.' : 'Could not create the report. Please try again.')}</p>}</section>
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{reportOptions.map((report) => <section key={report.type} className="flex flex-col rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex items-start justify-between gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-primary"><FileSpreadsheet className="h-5 w-5" /></div>{downloaded === report.type && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}</div><h2 className="font-display text-lg font-bold">{rtl ? report.ar : report.en}</h2><p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{rtl ? report.descriptionAr : report.descriptionEn}</p><button onClick={() => void download(report.type)} disabled={active !== null} className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">{active === report.type ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{rtl ? 'تنزيل XLSX' : 'Download XLSX'}</button></section>)}</div>
    <div className="rounded-[20px] border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-900"><p className="font-bold">{rtl ? 'ملاحظة حول البيانات' : 'Data note'}</p><p className="mt-1">{rtl ? 'تُحفظ التقارير بصيغة XLSX فعلية، وتبقى العملات منفصلة. السلات المتروكة تعتمد على النشاط الذي تم تسجيله بعد تفعيل التتبع.' : 'Reports are real XLSX files and currencies remain separate. Abandoned-cart data begins with tracked cart activity.'}</p></div>
  </div>;
}
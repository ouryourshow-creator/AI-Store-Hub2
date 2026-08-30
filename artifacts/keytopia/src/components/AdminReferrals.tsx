import { format } from 'date-fns';
import { CheckCircle2, Gift, GitBranch, Users } from 'lucide-react';
import {
  getListAdminReferralsQueryKey,
  useListAdminReferrals,
} from '@workspace/api-client-react';
import { useLang } from '../contexts/LanguageContext';

export default function AdminReferrals() {
  const { dir } = useLang();
  const { data: referrals, isLoading, isError } = useListAdminReferrals({
    query: { queryKey: getListAdminReferralsQueryKey() },
  });
  const totalReferred = referrals?.reduce((sum, item) => sum + item.referredCustomers, 0) ?? 0;
  const successful = referrals?.reduce((sum, item) => sum + item.successfulOrders, 0) ?? 0;
  const pending = referrals?.reduce((sum, item) => sum + item.pendingRewardEgp, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          {dir === 'rtl' ? 'الإحالات' : 'Referrals'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {dir === 'rtl'
            ? 'تابع أداء أكواد الإحالة ومكافآت أول عملية شراء.'
            : 'Track referral codes and first-purchase rewards.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard icon={GitBranch} label={dir === 'rtl' ? 'أكواد نشطة' : 'Referral codes'} value={String(referrals?.length ?? 0)} />
        <SummaryCard icon={Users} label={dir === 'rtl' ? 'العملاء المُحالون' : 'Referred customers'} value={String(totalReferred)} />
        <SummaryCard icon={Gift} label={dir === 'rtl' ? 'مكافآت معلقة' : 'Pending rewards'} value={`EGP ${pending.toFixed(2)}`} />
      </div>

      <div className="overflow-hidden rounded-[24px] border border-black/[0.03] bg-white shadow-sm">
        {isLoading ? (
          <div className="p-14 text-center text-muted-foreground">{dir === 'rtl' ? 'جار التحميل…' : 'Loading…'}</div>
        ) : isError ? (
          <div className="p-14 text-center text-red-600">{dir === 'rtl' ? 'تعذر تحميل الإحالات.' : 'Could not load referrals.'}</div>
        ) : !referrals?.length ? (
          <div className="p-14 text-center">
            <GitBranch className="mx-auto mb-4 h-10 w-10 text-primary/30" />
            <p className="font-display font-bold">{dir === 'rtl' ? 'لا توجد إحالات بعد' : 'No referral activity yet'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{dir === 'rtl' ? 'ستظهر البيانات بعد استخدام أكواد الإحالة.' : 'Referral activity will appear here once codes are used.'}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-black/[0.03] px-6 py-4">
              <p className="text-sm font-semibold text-muted-foreground">
                {successful} {dir === 'rtl' ? 'عملية شراء ناجحة' : 'successful first purchases'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 text-start font-semibold">{dir === 'rtl' ? 'المُحيل' : 'Referrer'}</th>
                    <th className="px-6 py-4 text-start font-semibold">{dir === 'rtl' ? 'الكود' : 'Code'}</th>
                    <th className="px-6 py-4 text-start font-semibold">{dir === 'rtl' ? 'العملاء' : 'Customers'}</th>
                    <th className="px-6 py-4 text-start font-semibold">{dir === 'rtl' ? 'الشراء الأول' : 'Successful'}</th>
                    <th className="px-6 py-4 text-start font-semibold">{dir === 'rtl' ? 'المكافآت' : 'Rewards'}</th>
                    <th className="px-6 py-4 text-start font-semibold">{dir === 'rtl' ? 'آخر نشاط' : 'Last activity'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03]">
                  {referrals.map((referral) => (
                    <tr key={referral.referralCode} className="hover:bg-muted/20">
                      <td className="px-6 py-5">
                        <p className="font-semibold text-foreground">{referral.referrerName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{referral.referrerEmail || '—'}</p>
                      </td>
                      <td className="px-6 py-5"><code className="rounded-lg bg-blue-50 px-2.5 py-1 font-semibold text-primary">{referral.referralCode}</code></td>
                      <td className="px-6 py-5 font-semibold">{referral.referredCustomers}</td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />{referral.successfulOrders}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-semibold">EGP {referral.availableRewardEgp.toFixed(2)} available</div>
                        {referral.pendingRewardEgp > 0 && <div className="mt-1 text-xs text-amber-700">EGP {referral.pendingRewardEgp.toFixed(2)} pending</div>}
                      </td>
                      <td className="px-6 py-5 text-muted-foreground">
                        {referral.lastActivityAt ? format(new Date(referral.lastActivityAt), 'MMM d, yyyy') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof GitBranch; label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-black/[0.03] bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
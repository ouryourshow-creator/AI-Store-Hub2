import { formatDistanceToNow } from 'date-fns';
import { ArchiveX, Clock3, Mail, Package, Phone } from 'lucide-react';
import { useListAdminAbandonedCarts } from '@workspace/api-client-react';
import { useLang } from '../contexts/LanguageContext';

export default function AdminAbandonedCarts() {
  const { dir } = useLang();
  const { data: carts, isLoading, isError } = useListAdminAbandonedCarts();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            {dir === 'rtl' ? 'السلات المتروكة' : 'Abandoned carts'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {dir === 'rtl'
              ? 'السلات التي لم تشهد نشاطاً لمدة ساعة على الأقل.'
              : 'Carts with no activity for at least one hour.'}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
          <Clock3 className="h-4 w-4" />
          {carts?.length ?? 0} {dir === 'rtl' ? 'سلة' : 'open carts'}
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-black/[0.03] bg-white shadow-sm">
        {isLoading ? (
          <div className="p-14 text-center text-muted-foreground">
            {dir === 'rtl' ? 'جار التحميل…' : 'Loading…'}
          </div>
        ) : isError ? (
          <div className="p-14 text-center text-red-600">
            {dir === 'rtl' ? 'تعذر تحميل السلات المتروكة.' : 'Could not load abandoned carts.'}
          </div>
        ) : !carts?.length ? (
          <div className="p-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <ArchiveX className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="font-display font-bold text-foreground">
              {dir === 'rtl' ? 'لا توجد سلات متروكة' : 'No abandoned carts'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {dir === 'rtl' ? 'كل السلات النشطة تم التعامل معها.' : 'There are no inactive carts to follow up.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 text-start font-semibold">{dir === 'rtl' ? 'العميل' : 'Customer'}</th>
                  <th className="px-6 py-4 text-start font-semibold">{dir === 'rtl' ? 'المحتويات' : 'Contents'}</th>
                  <th className="px-6 py-4 text-start font-semibold">{dir === 'rtl' ? 'الإجمالي' : 'Subtotal'}</th>
                  <th className="px-6 py-4 text-start font-semibold">{dir === 'rtl' ? 'آخر نشاط' : 'Last active'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {carts.map((cart) => (
                  <tr key={cart.id} className="align-top hover:bg-muted/20">
                    <td className="px-6 py-5">
                      <p className="font-semibold text-foreground">{cart.customerName || (dir === 'rtl' ? 'زائر' : 'Guest')}</p>
                      {cart.customerEmail && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />{cart.customerEmail}
                        </p>
                      )}
                      {cart.customerPhone && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />{cart.customerPhone}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-2">
                        {cart.items.slice(0, 3).map((item) => (
                          <div key={`${item.productId}-${item.duration}`} className="flex items-center gap-2">
                            <Package className="h-4 w-4 shrink-0 text-primary" />
                            <span className="max-w-[290px] truncate font-medium text-foreground">{item.productName}</span>
                            <span className="whitespace-nowrap text-xs text-muted-foreground">×{item.quantity}</span>
                          </div>
                        ))}
                        {cart.items.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{cart.items.length - 3} {dir === 'rtl' ? 'منتجات أخرى' : 'more items'}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 font-display font-bold text-foreground">
                      {cart.currency} {cart.subtotal.toFixed(2)}
                    </td>
                    <td className="px-6 py-5 text-muted-foreground">
                      {formatDistanceToNow(new Date(cart.lastSeenAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
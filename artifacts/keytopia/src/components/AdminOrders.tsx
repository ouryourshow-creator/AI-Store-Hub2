import { useState, Fragment } from 'react';
import { useListAdminOrders, getListAdminOrdersQueryKey, useUpdateOrderStatus } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Package, Clock, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useLang } from '../contexts/LanguageContext';

const STATUSES = ['awaiting_payment', 'payment_proof_received', 'confirmed', 'fulfilled', 'cancelled'] as const;

export default function AdminOrders() {
  const { dir } = useLang();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const toggleOrder = (id: number) => setExpandedOrders((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const { data: orders, isLoading } = useListAdminOrders({}, {
    query: {
      queryKey: getListAdminOrdersQueryKey({}),
    }
  });

  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminOrdersQueryKey() });
        toast.success(dir === 'rtl' ? 'تم تحديث حالة الطلب' : 'Order status updated');
      },
      onError: () => {
        toast.error(dir === 'rtl' ? 'فشل تحديث حالة الطلب' : 'Failed to update order status');
      }
    }
  });

  const filteredOrders = (orders || []).filter(order => {
    const matchesSearch = search === '' ||
      String(order.orderNumber).toLowerCase().includes(search.toLowerCase()) ||
      order.customerName.toLowerCase().includes(search.toLowerCase()) ||
      order.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      order.customerPhone.includes(search);

    const matchesStatus = statusFilter === '' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusLabel = (status: string) => {
    const map: Record<string, { ar: string, en: string, bg: string, text: string }> = {
      awaiting_payment: { ar: 'بانتظار الدفع', en: 'Awaiting Payment', bg: 'bg-amber-50', text: 'text-amber-700' },
      payment_proof_received: { ar: 'تم استلام الإيصال', en: 'Proof Received', bg: 'bg-blue-50', text: 'text-blue-700' },
      confirmed: { ar: 'مؤكد', en: 'Confirmed', bg: 'bg-indigo-50', text: 'text-indigo-700' },
      fulfilled: { ar: 'مكتمل', en: 'Fulfilled', bg: 'bg-emerald-50', text: 'text-emerald-700' },
      cancelled: { ar: 'ملغي', en: 'Cancelled', bg: 'bg-red-50', text: 'text-red-700' },
    };
    return map[status] || { ar: status, en: status, bg: 'bg-gray-50', text: 'text-gray-700' };
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-[24px] border border-black/[0.03] shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-muted-foreground ${dir === 'rtl' ? 'right-4' : 'left-4'}`} />
          <input
            type="text"
            placeholder={dir === 'rtl' ? 'البحث بالاسم، الإيميل، رقم الطلب...' : 'Search by name, email, order number...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full bg-muted border-none rounded-xl py-3 text-sm focus:ring-2 focus:ring-primary outline-none ${dir === 'rtl' ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
          />
        </div>
        <div className="w-full md:w-64">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none bg-muted border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none font-semibold text-foreground cursor-pointer"
            >
              <option value="">{dir === 'rtl' ? 'جميع الحالات' : 'All Statuses'}</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{dir === 'rtl' ? getStatusLabel(s).ar : getStatusLabel(s).en}</option>
              ))}
            </select>
            <ChevronDown className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground ${dir === 'rtl' ? 'left-4' : 'right-4'}`} />
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-[24px] border border-black/[0.03] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-muted/30 border-b border-black/[0.03] text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <th className={`px-6 py-4 font-semibold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{dir === 'rtl' ? 'الطلب' : 'Order'}</th>
                <th className={`px-6 py-4 font-semibold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{dir === 'rtl' ? 'العميل' : 'Customer'}</th>
                <th className={`px-6 py-4 font-semibold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{dir === 'rtl' ? 'الإجمالي' : 'Total'}</th>
                <th className={`px-6 py-4 font-semibold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{dir === 'rtl' ? 'الحالة' : 'Status'}</th>
                <th className={`px-6 py-4 font-semibold ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{dir === 'rtl' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                      {dir === 'rtl' ? 'جارٍ تحميل الطلبات...' : 'Loading orders...'}
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Package className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-lg font-semibold text-foreground mb-1">{dir === 'rtl' ? 'لا توجد طلبات' : 'No orders found'}</p>
                      <p className="text-sm">{dir === 'rtl' ? 'لم يتم العثور على أي طلبات تطابق بحثك.' : 'No orders match your current filters.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
  filteredOrders.map(order => {
                  const conf = getStatusLabel(order.status);
                  const expanded = expandedOrders.has(order.id);
                  return (
                    <Fragment key={order.id}>
                    <tr onClick={() => toggleOrder(order.id)} className="hover:bg-muted/10 transition-colors group cursor-pointer">
                      <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <div className="font-display font-bold text-foreground mb-1 flex items-center gap-2">
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                          {order.orderNumber}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {format(new Date(order.createdAt), 'MMM d, yyyy HH:mm')}
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <div className="font-semibold text-foreground">{order.customerName}</div>
                        <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{order.customerPhone}</div>
                      </td>
                      <td className={`px-6 py-4 font-display font-bold text-foreground ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        {order.currency} {order.total}
                        <div className="text-xs font-normal text-muted-foreground mt-1">
                          {order.items.length} {dir === 'rtl' ? 'منتج' : 'items'}
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${conf.bg} ${conf.text}`}>
                          {dir === 'rtl' ? conf.ar : conf.en}
                        </span>
                      </td>
                      <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`} onClick={(e) => e.stopPropagation()}>
                        <div className={`flex items-center gap-2 ${dir === 'rtl' ? 'justify-end' : 'justify-end'}`}>
                          <div className="relative group/menu">
                            <button className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-lg transition-colors flex items-center gap-2">
                              {dir === 'rtl' ? 'تحديث الحالة' : 'Update Status'}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            <div className={`absolute top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-black/[0.05] p-2 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 ${dir === 'rtl' ? 'left-0' : 'right-0'}`}>
                              {STATUSES.map(s => {
                                const sConf = getStatusLabel(s);
                                return (
                                  <button
                                    key={s}
                                    onClick={() => updateStatus.mutate({ id: order.id, data: { status: s as any } })}
                                    disabled={order.status === s || updateStatus.isPending}
                                    className={`w-full text-start px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${order.status === s ? 'bg-primary/5 text-primary' : 'hover:bg-muted text-foreground'}`}
                                  >
                                    {dir === 'rtl' ? sConf.ar : sConf.en}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-muted/10">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="space-y-3">
                            {order.items.map(item => (
                              <div key={item.id} className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                  {item.coverImageUrl ? (
                                    <img src={item.coverImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                                      <span className="text-white/50 font-bold text-sm">{item.productName.charAt(0)}</span>
                                    </div>
                                  )}
                                </div>
                                <div className={`flex-1 min-w-0 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                  <div className="font-semibold text-foreground text-sm truncate">{item.productName}</div>
                                  <div className="text-xs text-muted-foreground">{item.duration}</div>
                                </div>
                                <div className={`shrink-0 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                                  <div className="font-medium text-foreground text-sm">{order.currency} {item.lineTotal}</div>
                                  <div className="text-xs text-muted-foreground">{dir === 'rtl' ? 'الكمية:' : 'Qty:'} {item.quantity}</div>
                                </div>
                              </div>
                            ))}
                            {order.promoCode && (
                              <div className="text-xs text-muted-foreground pt-2 border-t border-black/[0.05]">
                                {dir === 'rtl' ? 'كود الخصم:' : 'Promo code:'} <span className="font-semibold text-foreground">{order.promoCode}</span>
                                {order.discount > 0 && <span> — {dir === 'rtl' ? 'خصم' : 'discount'} {order.currency} {order.discount}</span>}
                              </div>
                            )}
                            {order.paymentMethod && (
                              <div className="text-xs text-muted-foreground">
                                {dir === 'rtl' ? 'طريقة الدفع:' : 'Payment method:'} <span className="font-semibold text-foreground">{order.paymentMethod}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

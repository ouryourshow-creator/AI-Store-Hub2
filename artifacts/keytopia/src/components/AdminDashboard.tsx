import { useGetAdminDashboard, getGetAdminDashboardQueryKey } from '@workspace/api-client-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { DollarSign, ShoppingBag, Eye, TrendingUp, TrendingDown, MapPin, Package } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import { getCountryName } from '../lib/countryNames';

export default function AdminDashboard() {
  const { dir } = useLang();
  const { data: dashboard, isLoading, error } = useGetAdminDashboard({
    query: {
      queryKey: getGetAdminDashboardQueryKey()
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
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
      <div className="bg-red-50 text-red-600 p-6 rounded-[24px] border border-red-100 flex items-center justify-center text-center">
        <div>
          <h3 className="font-semibold text-lg mb-1">{dir === 'rtl' ? 'حدث خطأ' : 'Error loading dashboard'}</h3>
          <p className="text-sm opacity-80">{dir === 'rtl' ? 'تعذر تحميل الإحصائيات' : 'Could not load statistics'}</p>
        </div>
      </div>
    );
  }

  const countries = dashboard.countries.slice(0, 5).map((item) => ({
    ...item,
    country: getCountryName(item.country, dir),
  }));

  const StatCard = ({ title, value, icon: Icon, trend }: any) => (
    <div className="bg-white p-6 rounded-[24px] border border-black/[0.03] shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trend > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <h3 className="text-muted-foreground text-sm font-semibold mb-1">{title}</h3>
        <div className="text-3xl font-display font-bold text-foreground">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title={dir === 'rtl' ? 'إجمالي المبيعات' : 'Total Sales'}
          value={`EGP ${dashboard.totalSales.toLocaleString()} · USD ${dashboard.totalSalesUsd.toLocaleString()}`}
          icon={DollarSign}
        />
        <StatCard
          title={dir === 'rtl' ? 'إجمالي الطلبات' : 'Total Orders'}
          value={dashboard.totalOrders.toLocaleString()}
          icon={ShoppingBag}
        />
        <StatCard
          title={dir === 'rtl' ? 'إجمالي الزيارات' : 'Total Visits'}
          value={dashboard.totalVisits.toLocaleString()}
          icon={Eye}
        />
      </div>

      {/* Main Chart */}
      <div className="bg-white p-6 rounded-[24px] border border-black/[0.03] shadow-sm">
        <h3 className="text-lg font-display font-bold mb-6">
          {dir === 'rtl' ? 'نظرة عامة على المبيعات والطلبات' : 'Sales & Orders Overview'}
        </h3>
        <div className="h-[350px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dashboard.trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                cursor={{ stroke: 'rgba(0,0,0,0.1)', strokeWidth: 2 }}
              />
              <Area yAxisId="left" type="monotone" dataKey="sales" name={dir === 'rtl' ? 'المبيعات' : 'Sales'} stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              <Area yAxisId="right" type="monotone" dataKey="orders" name={dir === 'rtl' ? 'الطلبات' : 'Orders'} stroke="hsl(var(--accent))" strokeWidth={3} fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Products */}
        <div className="bg-white p-6 rounded-[24px] border border-black/[0.03] shadow-sm">
          <h3 className="text-lg font-display font-bold mb-6 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {dir === 'rtl' ? 'المنتجات الأكثر مبيعاً' : 'Popular Products'}
          </h3>
          <div className="space-y-4">
            {dashboard.popularProducts.slice(0, 5).map((product, i) => (
              <div key={product.productId} className="flex items-center justify-between p-4 rounded-[16px] bg-muted/30 border border-black/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-xs text-muted-foreground shadow-sm">
                    {i + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{product.productName}</h4>
                    <p className="text-xs text-muted-foreground">{product.views} {dir === 'rtl' ? 'مشاهدة' : 'views'}</p>
                  </div>
                </div>
                <div className="text-end">
                  <div className="font-bold text-sm text-emerald-600">{product.sold}</div>
                  <div className="text-xs text-muted-foreground">{dir === 'rtl' ? 'مبيعات' : 'sold'}</div>
                </div>
              </div>
            ))}
            {dashboard.popularProducts.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                {dir === 'rtl' ? 'لا توجد بيانات' : 'No data available'}
              </div>
            )}
          </div>
        </div>

        {/* Top Countries */}
        <div className="bg-white p-6 rounded-[24px] border border-black/[0.03] shadow-sm">
          <h3 className="text-lg font-display font-bold mb-6 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {dir === 'rtl' ? 'الزيارات حسب البلد' : 'Visits by Country'}
          </h3>
          <div className="h-[300px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countries} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="country" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--foreground))', fontWeight: 600 }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="visits" name={dir === 'rtl' ? 'الزيارات' : 'Visits'} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {dashboard.countries.length === 0 && (
            <div className="text-center text-muted-foreground py-8 -mt-40">
              {dir === 'rtl' ? 'لا توجد بيانات' : 'No data available'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Boxes, ChevronLeft, CircleDollarSign, FileSpreadsheet,
  Gift, LayoutDashboard, LogOut, Menu, MessageSquareText, PackageCheck,
  Search, Settings, ShoppingCart, Tags, TicketPercent, UsersRound,
  UserRoundPlus, WalletCards, X,
} from 'lucide-react';
import { Link } from 'wouter';

export type AdminSection =
  | 'dashboard' | 'sales' | 'orders' | 'visits' | 'abandoned'
  | 'users' | 'cashback' | 'referrals' | 'products' | 'categories'
  | 'reviews' | 'promo' | 'analytics' | 'reports' | 'settings';

type Item = { id: AdminSection; ar: string; en: string; icon: typeof LayoutDashboard };
const groups: Array<{ ar?: string; en?: string; items: Item[] }> = [
  { items: [{ id: 'dashboard', ar: 'نظرة عامة', en: 'Overview', icon: LayoutDashboard }] },
  { ar: 'المبيعات', en: 'Sales', items: [
    { id: 'sales', ar: 'المبيعات', en: 'Sales', icon: CircleDollarSign },
    { id: 'orders', ar: 'الطلبات', en: 'Orders', icon: PackageCheck },
    { id: 'visits', ar: 'الزيارات', en: 'Traffic', icon: BarChart3 },
    { id: 'abandoned', ar: 'السلات المتروكة', en: 'Abandoned carts', icon: ShoppingCart },
  ] },
  { ar: 'العملاء', en: 'Customers', items: [
    { id: 'users', ar: 'المستخدمون', en: 'Customers', icon: UsersRound },
    { id: 'cashback', ar: 'كاش باك', en: 'Cashback', icon: WalletCards },
    { id: 'referrals', ar: 'الإحالات', en: 'Referrals', icon: UserRoundPlus },
  ] },
  { ar: 'المتجر', en: 'Store', items: [
    { id: 'products', ar: 'المنتجات', en: 'Products', icon: Boxes },
    { id: 'categories', ar: 'الفئات', en: 'Categories', icon: Tags },
    { id: 'reviews', ar: 'التقييمات', en: 'Reviews', icon: MessageSquareText },
    { id: 'promo', ar: 'أكواد الخصم', en: 'Coupons', icon: TicketPercent },
  ] },
  { ar: 'التحليلات', en: 'Analytics', items: [
    { id: 'analytics', ar: 'التحليلات', en: 'Analytics', icon: BarChart3 },
    { id: 'reports', ar: 'التقارير', en: 'Reports', icon: FileSpreadsheet },
  ] },
  { ar: 'النظام', en: 'System', items: [
    { id: 'settings', ar: 'الإعدادات', en: 'Settings', icon: Settings },
  ] },
];

export const adminSections = new Set(groups.flatMap(group => group.items.map(item => item.id)));

export function AdminShell({ active, onNavigate, onLogout, dir, children }: {
  active: AdminSection;
  onNavigate: (section: AdminSection) => void;
  onLogout: () => void;
  dir: 'rtl' | 'ltr';
  children: ReactNode;
}) {
  const rtl = dir === 'rtl';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = useMemo(() => groups.flatMap(group => group.items).find(item => item.id === active)!, [active]);

  useEffect(() => setMobileOpen(false), [active]);

  const nav = (
    <>
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
        {!collapsed && <Link href="/" className="font-display font-black text-xl text-[#102A43] tracking-tight">Keytopia</Link>}
        <button aria-label={rtl ? 'طي القائمة' : 'Collapse navigation'} onClick={() => setCollapsed(value => !value)} className="hidden lg:grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-primary">
          <ChevronLeft className={`w-4 h-4 transition-transform ${rtl ? '' : 'rotate-180'} ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        <button aria-label="Close" onClick={() => setMobileOpen(false)} className="lg:hidden"><X className="w-5 h-5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-5" aria-label={rtl ? 'التنقل الإداري' : 'Admin navigation'}>
        {groups.map((group, index) => <div key={group.en ?? index}>
          {group.ar && !collapsed && <p className="px-3 mb-1.5 text-[11px] font-bold tracking-wider text-slate-400">{rtl ? group.ar : group.en}</p>}
          <div className="space-y-1">{group.items.map(item => {
            const Icon = item.icon;
            const selected = item.id === active;
            return <button key={item.id} title={collapsed ? (rtl ? item.ar : item.en) : undefined} onClick={() => onNavigate(item.id)} className={`group relative w-full h-10 flex items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${selected ? 'bg-blue-50 text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-[#102A43]'}`}>
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{rtl ? item.ar : item.en}</span>}
              {selected && <span className={`absolute inset-y-2 w-0.5 rounded-full bg-primary ${rtl ? 'right-0' : 'left-0'}`} />}
            </button>;
          })}</div>
        </div>)}
      </nav>
      <div className="p-3 border-t border-slate-200">
        <button onClick={onLogout} title={collapsed ? (rtl ? 'تسجيل الخروج' : 'Sign out') : undefined} className="w-full h-10 flex items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600">
          <LogOut className="w-[18px] h-[18px] shrink-0" />{!collapsed && (rtl ? 'تسجيل الخروج' : 'Sign out')}
        </button>
      </div>
    </>
  );

  return <div className="min-h-[100dvh] bg-[#F6F8FB] text-[#102A43]" dir={dir}>
    {mobileOpen && <button className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`fixed inset-y-0 z-50 bg-white border-slate-200 flex flex-col transition-[width,transform] duration-200 ${rtl ? 'right-0 border-l' : 'left-0 border-r'} ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'} w-64 ${mobileOpen ? 'translate-x-0' : rtl ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>{nav}</aside>
    <div className={`min-h-[100dvh] transition-[margin] duration-200 ${rtl ? (collapsed ? 'lg:mr-[72px]' : 'lg:mr-64') : (collapsed ? 'lg:ml-[72px]' : 'lg:ml-64')}`}>
      <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-7 flex items-center gap-4">
        <button onClick={() => setMobileOpen(true)} className="lg:hidden grid h-9 w-9 place-items-center rounded-lg border"><Menu className="w-5 h-5" /></button>
        <div className="min-w-0"><h1 className="font-display font-bold text-lg truncate">{rtl ? current.ar : current.en}</h1><p className="hidden sm:block text-xs text-slate-400">{rtl ? 'مركز عمليات Keytopia' : 'Keytopia operations center'}</p></div>
        <div className="relative ms-auto w-full max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={query} onFocus={() => setSearchOpen(true)} onChange={event => { setQuery(event.target.value); setSearchOpen(true); }} placeholder={rtl ? 'ابحث عن عميل، طلب، منتج…' : 'Search customer, order, product…'} className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 ps-10 pe-3 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10" />
          {searchOpen && query.trim() && <div className="absolute top-12 inset-x-0 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            <p className="text-xs font-bold text-slate-500 mb-2">{rtl ? 'بحث سريع' : 'Quick search'}</p>
            <button onClick={() => { onNavigate('users'); setSearchOpen(false); }} className="w-full flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-slate-50"><UsersRound className="w-4 h-4 text-primary" />{rtl ? `البحث عن “${query}” في المستخدمين` : `Find “${query}” in customers`}</button>
            <button onClick={() => { onNavigate('orders'); setSearchOpen(false); }} className="w-full flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-slate-50"><PackageCheck className="w-4 h-4 text-primary" />{rtl ? `البحث عن “${query}” في الطلبات` : `Find “${query}” in orders`}</button>
            <button onClick={() => { onNavigate('products'); setSearchOpen(false); }} className="w-full flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-slate-50"><Boxes className="w-4 h-4 text-primary" />{rtl ? `البحث عن “${query}” في المنتجات` : `Find “${query}” in products`}</button>
          </div>}
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 px-3 h-10 text-sm font-bold"><Gift className="w-4 h-4 text-cyan-500" /><span>Admin</span></div>
      </header>
      <main className="w-full max-w-[1600px] mx-auto p-4 lg:p-7">{children}</main>
    </div>
  </div>;
}


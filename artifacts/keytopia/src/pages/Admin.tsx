import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/react';
import {
  useListAdminProducts, getListAdminProductsQueryKey,
  useDeleteProduct, Product,
  useSetProductPublished,
  useListPromoCodes, useCreatePromoCode, useDeletePromoCode, getListPromoCodesQueryKey,
  useListCategories, useCreateCategory, useDeleteCategory, getListCategoriesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Plus, Pencil, Trash2, LogOut, Search, Tag, X, Layers, Eye, EyeOff, Gift } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { toast } from 'sonner';
import { useLang } from '../contexts/LanguageContext';
import AdminProductModal from '../components/AdminProductModal';
import AdminDashboard from '../components/AdminDashboard';
import AdminAnalytics from '../components/AdminAnalytics';
import AdminOrders from '../components/AdminOrders';
import AdminCashback from '../components/AdminCashback';
import AdminUsers from '../components/AdminUsers';
import AdminReviews from '../components/AdminReviews';
import AdminSettings from '../components/AdminSettings';

type Tab = 'dashboard' | 'visits' | 'sales' | 'orders' | 'users' | 'cashback' | 'products' | 'reviews' | 'promo' | 'categories' | 'settings';

export default function Admin() {
  const { isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const { t, dir } = useLang();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation('/sign-in');
  }, [isLoaded, isSignedIn, setLocation]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch('/api/admin/me', { credentials: 'include' })
      .then((r) => setIsAdmin(r.ok))
      .catch(() => setIsAdmin(false));
  }, [isLoaded, isSignedIn]);

  const handleLogout = () => signOut({ redirectUrl: '/' });

  const queryClient = useQueryClient();

  // Products
  const { data: products, isLoading } = useListAdminProducts({
    query: { enabled: isAdmin === true, queryKey: getListAdminProductsQueryKey() },
  });
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const deleteMutation = useDeleteProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
        toast.success(dir === 'rtl' ? 'تم حذف المنتج' : 'Product deleted');
      },
      onError: () => toast.error(dir === 'rtl' ? 'فشل حذف المنتج' : 'Failed to delete product'),
    },
  });

  const togglePublishedMutation = useSetProductPublished({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
        const msg = updated.published
          ? (dir === 'rtl' ? 'تم نشر المنتج' : 'Product published')
          : (dir === 'rtl' ? 'تم إخفاء المنتج' : 'Product unpublished');
        toast.success(msg);
      },
      onError: () => toast.error(dir === 'rtl' ? 'فشل تغيير حالة النشر' : 'Failed to update visibility'),
    },
  });

  const handleEdit = (product: Product) => { setEditingProduct(product); setIsModalOpen(true); };
  const handleAdd = () => { setEditingProduct(null); setIsModalOpen(true); };
  const handleDelete = (id: number) => {
    if (confirm(dir === 'rtl' ? 'هل أنت متأكد من حذف هذا المنتج؟' : 'Are you sure you want to delete this product?')) {
      deleteMutation.mutate({ id });
    }
  };

  // Promo codes
  const { data: promoCodes, isLoading: promoLoading } = useListPromoCodes({
    query: { enabled: isAdmin === true, queryKey: getListPromoCodesQueryKey() },
  });
  const [promoForm, setPromoForm] = useState({ code: '', percentage: '10', applicableAll: true, productIds: [] as number[] });
  const [promoSubmitting, setPromoSubmitting] = useState(false);

  const createPromoMutation = useCreatePromoCode({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPromoCodesQueryKey() });
        setPromoForm({ code: '', percentage: '10', applicableAll: true, productIds: [] });
        toast.success(dir === 'rtl' ? 'تم إنشاء كود الخصم' : 'Promo code created');
        setPromoSubmitting(false);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? (dir === 'rtl' ? 'فشل إنشاء الكود' : 'Failed to create code');
        toast.error(msg);
        setPromoSubmitting(false);
      },
    },
  });

  const deletePromoMutation = useDeletePromoCode({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPromoCodesQueryKey() });
        toast.success(dir === 'rtl' ? 'تم حذف الكود' : 'Code deleted');
      },
    },
  });

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoForm.code.trim() || !promoForm.percentage) return;
    setPromoSubmitting(true);
    createPromoMutation.mutate({
      data: {
        code: promoForm.code.trim().toUpperCase(),
        percentage: Number(promoForm.percentage),
        applicableProductIds: promoForm.applicableAll ? undefined : promoForm.productIds,
      },
    });
  };

  const toggleProductId = (id: number) => {
    setPromoForm(f => ({
      ...f,
      productIds: f.productIds.includes(id) ? f.productIds.filter(x => x !== id) : [...f.productIds, id],
    }));
  };

  // Categories
  const { data: categories, isLoading: categoriesLoading } = useListCategories({
    query: { enabled: isAdmin === true, queryKey: getListCategoriesQueryKey() },
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  const createCategoryMutation = useCreateCategory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        setNewCategoryName('');
        toast.success(dir === 'rtl' ? 'تم إنشاء الفئة' : 'Category created');
        setCategorySubmitting(false);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? (dir === 'rtl' ? 'فشل إنشاء الفئة' : 'Failed to create category');
        toast.error(msg);
        setCategorySubmitting(false);
      },
    },
  });

  const deleteCategoryMutation = useDeleteCategory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        toast.success(dir === 'rtl' ? 'تم حذف الفئة' : 'Category deleted');
      },
    },
  });

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCategorySubmitting(true);
    createCategoryMutation.mutate({ data: { name: newCategoryName.trim() } });
  };

  // Loading / auth states
  if (!isLoaded || (isSignedIn && isAdmin === null)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isSignedIn) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (isAdmin === false) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background" dir={dir}>
        <div className="absolute top-6 start-6">
          <Link href="/" className="font-display font-bold text-xl text-secondary">Keytopia</Link>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-card p-8 rounded-[24px] shadow-xl border border-black/[0.03] text-center">
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-6 mx-auto">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <h1 className="text-2xl font-display font-bold mb-2">{dir === 'rtl' ? 'غير مصرح' : 'Access Denied'}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {dir === 'rtl' ? 'هذا الحساب غير مدرج في قائمة المسؤولين.' : 'Your account is not on the admin whitelist.'}
            </p>
            <button onClick={handleLogout} className="w-full bg-secondary hover:bg-secondary/90 text-white font-semibold py-3 rounded-[16px] transition-all">
              {dir === 'rtl' ? 'تسجيل الخروج' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredProducts = products?.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())) || [];
  const inputCls = "w-full bg-muted border border-transparent rounded-[10px] px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F7F9FC]" dir={dir}>
      <header className="bg-white border-b border-black/[0.03] px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-display font-bold text-xl text-secondary">Keytopia</Link>
          <span className="px-2 py-1 bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-wider rounded">Admin</span>
        </div>
        <button
          onClick={handleLogout}
          data-testid="button-admin-logout"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t('logOut')}
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
        {/* Tab bar */}
        <div className="flex gap-2 mb-8 border-b border-black/[0.06] pb-0 overflow-x-auto">
          {(['dashboard', 'visits', 'sales', 'orders', 'users', 'cashback', 'products', 'reviews', 'categories', 'promo', 'settings'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-t-[10px] transition-all border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab
                  ? 'border-primary text-primary bg-white'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'dashboard' ? (dir === 'rtl' ? 'نظرة عامة' : 'Overview') : tab === 'visits' ? (dir === 'rtl' ? 'الزيارات' : 'Visits') : tab === 'sales' ? (dir === 'rtl' ? 'المبيعات' : 'Sales') : tab === 'orders' ? (dir === 'rtl' ? 'الطلبات' : 'Orders') : tab === 'users' ? (dir === 'rtl' ? 'المستخدمون' : 'Users') : tab === 'cashback' ? <span className="inline-flex items-center gap-1.5"><Gift className="w-4 h-4" />{t('cashback')}</span> : tab === 'products' ? t('products') : tab === 'reviews' ? (dir === 'rtl' ? 'التقييمات' : 'Reviews') : tab === 'categories' ? t('categories') : tab === 'settings' ? t('settings') : t('promoCodes')}
            </button>
          ))}
        </div>

        {/* ── Products tab ── */}
        {activeTab === 'dashboard' && <AdminDashboard />}

        {activeTab === 'visits' && <AdminAnalytics kind="visits" />}

        {activeTab === 'sales' && <AdminAnalytics kind="sales" />}

        {activeTab === 'orders' && <AdminOrders />}

        {activeTab === 'users' && <AdminUsers />}

        {activeTab === 'cashback' && <AdminCashback />}

        {activeTab === 'reviews' && <AdminReviews />}

        {activeTab === 'settings' && <AdminSettings />}

        {activeTab === 'products' && (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground">{t('products')}</h1>
                <p className="text-muted-foreground mt-1">{t('manageProducts')}</p>
              </div>
              <button
                onClick={handleAdd}
                data-testid="button-add-product"
                className="bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6 rounded-full transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {t('addProduct')}
              </button>
            </div>

            <div className="bg-white rounded-[24px] shadow-sm border border-black/[0.03] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-black/[0.03] flex items-center">
                <div className="relative w-full max-w-sm">
                  <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={t('searchProducts')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-testid="input-admin-search"
                    className="w-full bg-muted border-none rounded-full ps-10 pe-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-black/[0.03] text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      <th className="px-6 py-4 font-semibold">{t('product')}</th>
                      <th className="px-6 py-4 font-semibold">{t('duration')}</th>
                      <th className="px-6 py-4 font-semibold">{t('price')}</th>
                      <th className="px-6 py-4 font-semibold">{dir === 'rtl' ? 'الحالة' : 'Status'}</th>
                      <th className="px-6 py-4 font-semibold text-end">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.03]">
                    {isLoading ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">{t('loading')}</td></tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">{t('noProductsAdmin')}</td></tr>
                    ) : (
                      filteredProducts.map((product) => (
                        <tr key={product.id} data-testid={`row-product-${product.id}`} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-[8px] overflow-hidden bg-muted flex-shrink-0">
                                {product.coverImageUrl ? (
                                  <img src={product.coverImageUrl} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                                    <span className="text-white/50 font-bold text-xs">{product.name.charAt(0)}</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-display font-semibold text-foreground">{product.name}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description || t('noDescription')}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-accent/20 text-secondary text-xs font-semibold rounded-full">{product.duration}</span>
                          </td>
                          <td className="px-6 py-4 font-display font-semibold">EGP {product.price}</td>
                          <td className="px-6 py-4">
                            {product.published !== false ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Eye className="w-3 h-3" />
                                {t('published')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <EyeOff className="w-3 h-3" />
                                {t('unpublished')}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => togglePublishedMutation.mutate({ id: product.id, data: { published: !product.published } })}
                                data-testid={`button-toggle-published-${product.id}`}
                                title={product.published !== false ? t('unpublish') : t('publish')}
                                className={`p-2 rounded-full transition-colors ${product.published !== false ? 'text-emerald-600 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-600 hover:text-emerald-600 hover:bg-emerald-50'}`}
                              >
                                {product.published !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <button onClick={() => handleEdit(product)} data-testid={`button-edit-product-${product.id}`} className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(product.id)} data-testid={`button-delete-product-${product.id}`} className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── Categories tab ── */}
        {activeTab === 'categories' && (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-display font-bold text-foreground">{t('categories')}</h1>
              <p className="text-muted-foreground mt-1">{t('manageCategories')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Create form */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-[20px] border border-black/[0.03] shadow-sm p-6">
                  <h2 className="text-base font-display font-bold mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    {t('addCategory')}
                  </h2>
                  <form onSubmit={handleCreateCategory} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{t('categoryName')}</label>
                      <input
                        type="text"
                        required
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        placeholder={dir === 'rtl' ? 'مثال: أدوات الذكاء الاصطناعي' : 'e.g. AI Tools'}
                        className={inputCls}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={categorySubmitting || !newCategoryName.trim()}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-[12px] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {t('addCategory')}
                    </button>
                  </form>
                </div>
              </div>

              {/* Categories list */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-[20px] border border-black/[0.03] shadow-sm overflow-hidden">
                  {categoriesLoading ? (
                    <div className="p-12 text-center text-muted-foreground">{t('loading')}</div>
                  ) : !categories?.length ? (
                    <div className="p-12 text-center text-muted-foreground">{t('noCategories')}</div>
                  ) : (
                    <ul className="divide-y divide-black/[0.03]">
                      {categories.map(cat => (
                        <li key={cat.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Layers className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-semibold text-sm text-foreground">{cat.name}</span>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(dir === 'rtl' ? `حذف فئة "${cat.name}"؟` : `Delete category "${cat.name}"?`)) {
                                deleteCategoryMutation.mutate({ id: cat.id });
                              }
                            }}
                            className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Promo Codes tab ── */}
        {activeTab === 'promo' && (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-display font-bold text-foreground">{t('promoCodes')}</h1>
              <p className="text-muted-foreground mt-1">{t('managePromoCodes')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Create form */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-[20px] border border-black/[0.03] shadow-sm p-6">
                  <h2 className="text-base font-display font-bold mb-4 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" />
                    {t('addPromoCode')}
                  </h2>
                  <form onSubmit={handleCreatePromo} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{t('promoCodeLabel')}</label>
                      <input
                        type="text"
                        required
                        value={promoForm.code}
                        onChange={e => setPromoForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                        placeholder="SAVE20"
                        className={`${inputCls} font-mono tracking-widest`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{t('discountPercent')}</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={100}
                        value={promoForm.percentage}
                        onChange={e => setPromoForm(f => ({ ...f, percentage: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{t('applicableProducts')}</label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          checked={promoForm.applicableAll}
                          onChange={e => setPromoForm(f => ({ ...f, applicableAll: e.target.checked, productIds: [] }))}
                          className="w-4 h-4 rounded text-primary"
                        />
                        {t('allProducts')}
                      </label>
                      {!promoForm.applicableAll && (
                        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto border border-black/[0.06] rounded-[10px] p-2">
                          {(products ?? []).map(p => (
                            <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-muted/50">
                              <input
                                type="checkbox"
                                checked={promoForm.productIds.includes(p.id)}
                                onChange={() => toggleProductId(p.id)}
                                className="w-4 h-4 rounded text-primary"
                              />
                              <span className="truncate">{p.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={promoSubmitting}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-[12px] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {t('addPromoCode')}
                    </button>
                  </form>
                </div>
              </div>

              {/* Promo codes list */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-[20px] border border-black/[0.03] shadow-sm overflow-hidden">
                  {promoLoading ? (
                    <div className="p-12 text-center text-muted-foreground">{t('loading')}</div>
                  ) : !promoCodes?.length ? (
                    <div className="p-12 text-center text-muted-foreground">{t('noPromoCodes')}</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/30 border-b border-black/[0.03] text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          <th className="px-5 py-4 font-semibold">{t('promoCodeLabel')}</th>
                          <th className="px-5 py-4 font-semibold">{t('discountPercent')}</th>
                          <th className="px-5 py-4 font-semibold">{t('applicableProducts')}</th>
                          <th className="px-5 py-4 text-end font-semibold">{t('actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.03]">
                        {promoCodes.map(code => (
                          <tr key={code.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-5 py-4">
                              <span className="font-mono font-bold text-sm tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-[6px]">
                                {code.code}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span className="font-semibold text-[#1CC88A]">{code.percentage}%</span>
                            </td>
                            <td className="px-5 py-4 text-sm text-muted-foreground">
                              {code.applicableProductIds?.length
                                ? code.applicableProductIds.map(id => products?.find(p => p.id === id)?.name ?? `#${id}`).join(', ')
                                : t('allProducts')}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex justify-end">
                                <button
                                  onClick={() => {
                                    if (confirm(dir === 'rtl' ? 'حذف هذا الكود؟' : 'Delete this code?')) {
                                      deletePromoMutation.mutate({ id: code.id });
                                    }
                                  }}
                                  className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <AdminProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        product={editingProduct}
        onProductSaved={() => queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() })}
      />
    </div>
  );
}

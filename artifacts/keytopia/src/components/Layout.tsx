import { Link } from 'wouter';
import { ShoppingBag, LogIn, User } from 'lucide-react';
import { useUser } from '@clerk/react';
import { useCart } from '../contexts/CartContext';
import { useLang } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useState } from 'react';
import CartDrawer from './CartDrawer';

// Logo is served from the public/ folder
const logoImg = `${import.meta.env.BASE_URL}logo.png`;

export default function Layout({ children }: { children: React.ReactNode }) {
  const { cartCount } = useCart();
  const { t, toggleLang, dir } = useLang();
  const { currency, setCurrency } = useCurrency();
  const { isLoaded, isSignedIn } = useUser();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const navigation = dir === 'rtl'
    ? [
        { label: 'الرئيسية', href: '/' },
        { label: 'الأقسام', href: '/#products' },
        { label: 'من نحن', href: '/about' },
        { label: 'الاسترداد والخصوصية', href: '/policy' },
      ]
    : [
        { label: 'Home', href: '/' },
        { label: 'Categories', href: '/#products' },
        { label: 'About us', href: '/about' },
        { label: 'Refunds & privacy', href: '/policy' },
      ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background" dir={dir}>
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-black/[0.03]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between gap-5">
          <Link href="/" className="flex items-center gap-3 select-none">
            <img src={logoImg} alt="Keytopia" className="h-[6.75rem] w-auto object-contain" />
          </Link>

          <nav aria-label={dir === 'rtl' ? 'التنقل الرئيسي' : 'Main navigation'} className="hidden lg:flex items-center justify-center gap-6 xl:gap-9 text-sm font-semibold text-muted-foreground">
            {navigation.map((item) => (
              <a key={item.label} href={item.href} className="whitespace-nowrap hover:text-primary transition-colors">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <button
              onClick={toggleLang}
              aria-label="Toggle language"
              className="h-9 px-4 rounded-full border border-black/[0.08] bg-muted hover:bg-muted/80 text-sm font-semibold text-foreground transition-all"
            >
              {t('toggleLang')}
            </button>

            {/* Currency Toggle */}
            <button
              onClick={() => setCurrency(currency === 'EGP' ? 'USD' : 'EGP')}
              aria-label={currency === 'EGP' ? t('switchToUsd') : t('switchToEgp')}
              title={currency === 'EGP' ? t('switchToUsd') : t('switchToEgp')}
              className="h-9 min-w-[3.75rem] px-3 rounded-full border border-black/[0.08] bg-muted hover:bg-muted/80 text-sm font-semibold text-foreground transition-all"
            >
              {currency}
            </button>

            {/* Cart */}
            <button
              onClick={() => setIsCartOpen(true)}
              aria-label={t('cartAriaLabel')}
              className="relative p-2.5 rounded-full hover:bg-black/[0.03] transition-colors"
            >
              <ShoppingBag className="w-6 h-6 text-foreground" strokeWidth={1.5} />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-primary text-white text-xs font-bold rounded-full border-2 border-background">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Sign in / My Profile */}
            {isLoaded && (
              isSignedIn ? (
                <Link
                  href="/orders"
                  className="h-9 px-4 rounded-full bg-primary hover:bg-primary/90 text-white text-sm font-semibold flex items-center gap-1.5 transition-all"
                >
                  <User className="w-4 h-4" strokeWidth={2} />
                  {dir === 'rtl' ? 'ملفي الشخصي' : 'My Profile'}
                </Link>
              ) : (
                <Link
                  href="/sign-in"
                  className="h-9 px-4 rounded-full bg-primary hover:bg-primary/90 text-white text-sm font-semibold flex items-center gap-1.5 transition-all"
                >
                  <LogIn className="w-4 h-4" strokeWidth={2} />
                  {dir === 'rtl' ? 'تسجيل الدخول' : 'Sign in'}
                </Link>
              )
            )}
          </div>
        </div>
        <nav aria-label={dir === 'rtl' ? 'التنقل الرئيسي للهاتف' : 'Mobile navigation'} className="lg:hidden flex gap-5 overflow-x-auto no-scrollbar px-4 pb-3 text-sm font-semibold text-muted-foreground">
          {navigation.map((item) => (
            <a key={item.label} href={item.href} className="whitespace-nowrap hover:text-primary transition-colors">
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="py-12 text-center text-sm text-muted-foreground border-t border-black/[0.03] mt-auto">
        <p>&copy; {new Date().getFullYear()} Keytopia. {t('allRightsReserved')}</p>
        <div className="mt-4 flex justify-center gap-6">
          <Link href="/policy" className="hover:text-foreground transition-colors">{t('policyLink')}</Link>
          <Link href="/orders" className="hover:text-foreground transition-colors">{dir === 'rtl' ? 'طلباتي' : 'My orders'}</Link>
          <Link href="/admin" className="hover:text-foreground transition-colors">{t('adminLogin')}</Link>
        </div>
      </footer>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Floating WhatsApp button */}
      <a
        href="https://wa.me/201229327902"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp"
        className="fixed bottom-6 start-6 z-50 flex items-center gap-3 px-5 py-3 rounded-full bg-[#25D366] shadow-lg hover:bg-[#20c35e] hover:scale-105 active:scale-95 transition-all"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white shrink-0" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span className="text-white font-semibold text-sm leading-tight whitespace-nowrap">
          عندك سؤال؟ تواصل معانا
        </span>
      </a>
    </div>
  );
}

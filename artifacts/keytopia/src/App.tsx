import { ClerkProvider, useAuth } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useEffect } from 'react';
import { useRecordVisit } from '@workspace/api-client-react';
import { CartProvider } from './contexts/CartContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { CurrencyProvider, useCurrency } from './contexts/CurrencyContext';
import Home from './pages/Home';
import Admin from './pages/Admin';
import ProductPage from './pages/ProductPage';
import PolicyPage from './pages/PolicyPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import Orders from './pages/Orders';
import Checkout from './pages/Checkout';
import NotFound from './pages/not-found';
import { Toaster } from 'sonner';

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

// This app uses the owner's external Clerk instance. External publishable keys
// already encode their Frontend API host, so they must not be derived from the
// Replit preview hostname. Clerk production keys reject Replit preview origins,
// so preview uses the matching development instance key.
const clerkPubKey = import.meta.env.DEV
  ? import.meta.env.VITE_CLERK_DEV_PUBLISHABLE_KEY
  : import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.png`,
  },
  variables: {
    colorPrimary: '#2469FF',
    colorForeground: '#111827',
    colorMutedForeground: '#65758B',
    colorDanger: '#EF4444',
    colorBackground: '#F8FAFB',
    colorInput: '#E1E7F0',
    colorInputForeground: '#111827',
    colorNeutral: '#E1E7F0',
    fontFamily: "'Inter', sans-serif",
    borderRadius: '12px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#111827] font-semibold',
    headerSubtitle: 'text-[#65758B]',
    socialButtonsBlockButtonText: 'text-[#111827]',
    formFieldLabel: 'text-[#111827] font-medium',
    footerActionLink: 'text-[#2469FF]',
    footerActionText: 'text-[#65758B]',
    dividerText: 'text-[#65758B]',
    identityPreviewEditButton: 'text-[#2469FF]',
    formFieldSuccessText: 'text-green-600',
    alertText: 'text-[#EF4444]',
    // logo.png includes transparent padding, so scale the image inside a
    // fixed-height slot to keep the full Keytopia wordmark legible.
    logoBox: 'flex justify-center mb-3 h-16 overflow-visible',
    logoImage: 'h-16 w-auto max-w-[260px] object-contain scale-[2.5]',
    socialButtonsBlockButton: 'border border-[#E1E7F0] hover:bg-[#F8FAFB]',
    formButtonPrimary: 'bg-[#2469FF] hover:bg-[#1a57e8] text-white',
    formFieldInput: 'bg-[#F8FAFB] border border-[#E1E7F0] text-[#111827]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#E1E7F0]',
    alert: 'bg-red-50 border border-red-200',
    otpCodeFieldInput: 'border border-[#E1E7F0] bg-[#F8FAFB] text-[#111827]',
    formFieldRow: '',
    main: '',
  },
};

function VisitTracker() {
  const [location] = useLocation();
  const { setCurrency } = useCurrency();
  const recordVisit = useRecordVisit();

  useEffect(() => {
    // Product pages record after their product lookup resolves so visits retain
    // a product ID even when the public URL is a slug.
    if (location.startsWith('/products/')) return;
    const key = 'keytopia_visitor';
    const visitorId = localStorage.getItem(key) ?? crypto.randomUUID();
    localStorage.setItem(key, visitorId);
    recordVisit.mutate({
      data: { path: location, productId: null, visitorId },
    }, {
      onSuccess: (result) => setCurrency(result.currency),
    });
  }, [location]); // Only record on meaningful route changes.

  return null;
}

function ReferralLanding({ params }: { params: { code: string } }) {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  useEffect(() => {
    if (!isLoaded) return;
    const code = params.code.trim().toUpperCase();
    if (/^[A-Z0-9_-]{3,32}$/.test(code)) localStorage.setItem('keytopia_referral', code);
    // Referred visitors need an account for the referral to be attributed, so
    // send signed-out visitors straight to sign-in instead of the homepage.
    setLocation(isSignedIn ? '/' : '/sign-in', { replace: true });
  }, [params.code, setLocation, isLoaded, isSignedIn]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={clerkAppearance}
      localization={{
        signIn: {
          start: {
            title: 'Sign in to KeyTopia Store',
          },
        },
        signUp: {
          start: {
            title: 'Create your KeyTopia Store account',
          },
        },
      }}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <CurrencyProvider>
            <CartProvider>
              <VisitTracker />
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/products/:slug" component={ProductPage} />
                <Route path="/ref/:code" component={ReferralLanding} />
                <Route path="/policy" component={PolicyPage} />
                {/* REQUIRED — /*? optional wildcard matches both bare URL and Clerk OAuth sub-paths */}
                <Route path="/sign-in/*?" component={SignInPage} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                <Route path="/orders" component={Orders} />
                <Route path="/checkout" component={Checkout} />
                <Route path="/admin" component={Admin} />
                <Route component={NotFound} />
              </Switch>
              <Toaster position="top-center" />
            </CartProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

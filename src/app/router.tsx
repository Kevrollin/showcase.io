import { createBrowserRouter } from 'react-router';
import { NotFoundScreen, RouteErrorScreen } from '@/components/shared/ErrorScreens';
import { PageLoader } from '@/components/ui/primitives';
import { RootLayout } from './RootLayout';

/**
 * Every page is a lazy chunk. Public pages (landing, storefront, legal) never
 * load supabase-js; the AppShell layout route brings in auth for the rest.
 */
export const router = createBrowserRouter([
  {
    Component: RootLayout,
    ErrorBoundary: RouteErrorScreen,
    HydrateFallback: PageLoader,
    children: [
      { path: '/', lazy: () => import('@/features/marketing/LandingPage') },
      { path: '/privacy', lazy: () => import('@/features/marketing/PrivacyPage') },
      { path: '/terms', lazy: () => import('@/features/marketing/TermsPage') },
      { path: '/s/:slug', lazy: () => import('@/features/storefront/StorefrontPage') },
      { path: '/s/:slug/:itemSlug', lazy: () => import('@/features/storefront/ItemPage') },
      {
        lazy: () => import('@/features/auth/AppShell'),
        children: [
          {
            lazy: () => import('@/features/auth/GuestOnly'),
            children: [
              { path: '/login', lazy: () => import('@/features/auth/LoginPage') },
              { path: '/signup', lazy: () => import('@/features/auth/SignUpPage') },
              { path: '/forgot-password', lazy: () => import('@/features/auth/ForgotPasswordPage') },
            ],
          },
          { path: '/auth/confirm', lazy: () => import('@/features/auth/AuthCallbackPage') },
          { path: '/auth/callback', lazy: () => import('@/features/auth/AuthCallbackPage') },
          { path: '/reset-password', lazy: () => import('@/features/auth/ResetPasswordPage') },
          {
            lazy: () => import('@/features/auth/RequireAuth'),
            children: [
              { path: '/onboarding', lazy: () => import('@/features/onboarding/OnboardingPage') },
              // OAuth 2.1 consent screen (Supabase Auth -> OAuth Server -> Authorization URL).
              { path: '/oauth/consent', lazy: () => import('@/features/auth/OAuthConsentPage') },
              {
                path: '/dashboard',
                lazy: () => import('@/features/dashboard/DashboardLayout'),
                children: [
                  { index: true, lazy: () => import('@/features/dashboard/OverviewPage') },
                  { path: 'catalogue', lazy: () => import('@/features/catalogue/CataloguePage') },
                  { path: 'catalogue/new', lazy: () => import('@/features/catalogue/ItemEditorPage') },
                  { path: 'catalogue/:itemId', lazy: () => import('@/features/catalogue/ItemEditorPage') },
                  { path: 'categories', lazy: () => import('@/features/categories/CategoriesPage') },
                  { path: 'appearance', lazy: () => import('@/features/settings/AppearancePage') },
                  { path: 'share', lazy: () => import('@/features/sharing/SharePage') },
                  { path: 'settings', lazy: () => import('@/features/settings/SettingsPage') },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', Component: NotFoundScreen },
    ],
  },
]);

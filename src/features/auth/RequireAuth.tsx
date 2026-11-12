import { Navigate, Outlet, useLocation } from 'react-router';
import { PageLoader } from '@/components/ui/primitives';
import { useAuth } from './auth-context';

/** Protects dashboard/onboarding routes; sends guests to /login?next=… */
export function Component() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your session" />;
  if (!session) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

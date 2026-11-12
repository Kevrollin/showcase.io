import { Navigate, Outlet, useSearchParams } from 'react-router';
import { PageLoader } from '@/components/ui/primitives';
import { safeRedirect } from '@/config/site';
import { useAuth } from './auth-context';

/** Login/sign-up pages: signed-in users go straight to where they were heading. */
export function Component() {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <PageLoader />;
  if (session) return <Navigate to={safeRedirect(params.get('next'))} replace />;
  return <Outlet />;
}

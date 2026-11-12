import { Outlet } from 'react-router';
import { Toaster } from '@/components/ui/toaster';
import { isSupabaseConfigured } from '@/lib/env';
import { AuthProvider } from './AuthProvider';

/** Layout for every route that needs Supabase Auth (auth pages, onboarding, dashboard). */
export function Component() {
  return (
    <AuthProvider>
      {!isSupabaseConfigured && (
        <div role="alert" className="bg-warning-soft px-4 py-2 text-center text-sm text-warning">
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your project URL and anon key.
        </div>
      )}
      <Outlet />
      <Toaster />
    </AuthProvider>
  );
}

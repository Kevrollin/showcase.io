import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

export interface AuthState {
  session: Session | null;
  user: User | null;
  /** True until the persisted session has been restored. */
  loading: boolean;
  /** Set when the user arrived through a password-recovery link. */
  recovery: boolean;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

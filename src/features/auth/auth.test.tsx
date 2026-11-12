import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { safeRedirect } from '@/config/site';
import { AuthContext, type AuthState } from './auth-context';
import { Component as GuestOnly } from './GuestOnly';
import { Component as LoginPage } from './LoginPage';
import { Component as RequireAuth } from './RequireAuth';
import { Component as SignUpPage } from './SignUpPage';

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

function renderAt(path: string, auth: Partial<AuthState>) {
  const value: AuthState = { session: null, user: null, loading: false, recovery: false, ...auth };
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [{ path: '/dashboard/catalogue', element: <p>Private catalogue</p> }],
      },
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignUpPage /> },
        ],
      },
      { path: '*', element: <Where /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={value}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return router;
}

const session = { user: { id: 'u1', email: 'a@b.co', user_metadata: {} } } as unknown as Session;

describe('route protection', () => {
  it('sends guests to sign in and remembers where they were going', () => {
    const router = renderAt('/dashboard/catalogue?x=1', {});
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/dashboard/catalogue?x=1')}`);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('lets signed-in users through', () => {
    renderAt('/dashboard/catalogue', { session, user: session.user });
    expect(screen.getByText('Private catalogue')).toBeInTheDocument();
  });

  it('waits for the session to be restored instead of redirecting', () => {
    const router = renderAt('/dashboard/catalogue', { loading: true });
    expect(router.state.location.pathname).toBe('/dashboard/catalogue');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not send signed-in users back to the login page', () => {
    const router = renderAt('/login?next=%2Fdashboard%2Fcatalogue', { session, user: session.user });
    expect(router.state.location.pathname).toBe('/dashboard/catalogue');
  });

  it('only follows same-site redirects', () => {
    expect(safeRedirect('/dashboard/share')).toBe('/dashboard/share');
    expect(safeRedirect('https://evil.example')).toBe('/dashboard');
    expect(safeRedirect('//evil.example')).toBe('/dashboard');
    expect(safeRedirect('/\\evil.example')).toBe('/dashboard');
    expect(safeRedirect(null, '/onboarding')).toBe('/onboarding');
  });
});

describe('auth forms', () => {
  it('validates the sign-in form before contacting the server', async () => {
    const user = userEvent.setup();
    renderAt('/login', {});
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('explains password rules on sign up', async () => {
    const user = userEvent.setup();
    renderAt('/signup', {});
    await user.type(screen.getByLabelText('Your name'), 'Wanjiru');
    await user.type(screen.getByLabelText('Email'), 'wanjiru@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
  });

  it('can reveal the password', async () => {
    const user = userEvent.setup();
    renderAt('/login', {});
    const input = screen.getByLabelText(/^Password/);
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});

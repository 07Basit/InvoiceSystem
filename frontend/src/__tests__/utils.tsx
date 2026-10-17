import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { AuthUser } from 'shared';

export const testUser: AuthUser = {
  id: 'u1',
  username: 'admin',
  displayName: 'Administrator',
  email: 'admin@example.com',
  role: 'ADMIN',
  lastLoginAt: '2026-10-17T05:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export function setAuth(state: 'loading' | 'authenticated' | 'unauthenticated', extra: Partial<ReturnType<typeof useAuthStore.getState>> = {}) {
  useAuthStore.setState({
    status: state,
    user: state === 'authenticated' ? testUser : null,
    rememberMe: false,
    expiresAt: state === 'authenticated' ? '2099-01-01T00:00:00.000Z' : null,
    ...extra,
  });
}

/** Shows the current path so tests can assert redirects. */
export function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

export function renderRoutes(ui: ReactElement, { route = '/', path = '*' }: { route?: string; path?: string } = {}): RenderResult {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

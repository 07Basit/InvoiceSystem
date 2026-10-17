import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { setAuth } from '@/__tests__/utils';

function LoginProbe() {
  const location = useLocation();
  return <div data-testid="login">{`login from=${(location.state as { from?: string } | null)?.from}`}</div>;
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/invoices" element={<div>secret invoices</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => setAuth('unauthenticated'));

describe('ProtectedRoute', () => {
  it('shows a loader (not the page, not the login) while the session is being checked', () => {
    setAuth('loading');
    renderAt('/invoices');
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('secret invoices')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login')).not.toBeInTheDocument();
  });

  it('redirects signed-out visitors to /login and remembers where they were going', () => {
    renderAt('/invoices');
    expect(screen.getByTestId('login')).toHaveTextContent('login from=/invoices');
    expect(screen.queryByText('secret invoices')).not.toBeInTheDocument();
  });

  it('renders the page for signed-in users', () => {
    setAuth('authenticated');
    renderAt('/invoices');
    expect(screen.getByText('secret invoices')).toBeInTheDocument();
  });
});

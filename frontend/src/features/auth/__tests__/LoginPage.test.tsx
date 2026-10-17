import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../pages/LoginPage';
import { authService } from '../services/authService';
import { ApiClientError } from '@/services/api';
import { renderRoutes, setAuth, testUser } from '@/__tests__/utils';

vi.mock('../services/authService', () => ({
  authService: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
const api = vi.mocked(authService);
const session = { user: testUser, rememberMe: false, expiresAt: '2099-01-01T00:00:00.000Z' };

const renderLogin = (route = '/login', state?: unknown) =>
  renderRoutes(<LoginPage />, { route: state ? { pathname: route, state } as never : route, path: '/login' });

beforeEach(() => {
  vi.clearAllMocks();
  setAuth('unauthenticated');
});

describe('LoginPage', () => {
  it('renders username, password and the 7-day checkbox (unchecked by default)', () => {
    renderLogin();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Keep me signed in for 7 days' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('asks for both fields instead of calling the server when empty', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your username and password.');
    expect(api.login).not.toHaveBeenCalled();
  });

  it('submits trimmed username, password and rememberMe=false by default', async () => {
    api.login.mockResolvedValue(session);
    renderLogin();
    await userEvent.type(screen.getByLabelText('Username'), '  admin ');
    await userEvent.type(screen.getByLabelText('Password'), 'Secret-123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(api.login).toHaveBeenCalledWith({ username: 'admin', password: 'Secret-123', rememberMe: false });
  });

  it('sends rememberMe=true when "Keep me signed in" is ticked', async () => {
    api.login.mockResolvedValue({ ...session, rememberMe: true });
    renderLogin();
    await userEvent.type(screen.getByLabelText('Username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'Secret-123');
    await userEvent.click(screen.getByRole('checkbox', { name: /keep me signed in/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(api.login).toHaveBeenCalledWith(expect.objectContaining({ rememberMe: true }));
  });

  it('shows the server error and clears only the password after a failed login', async () => {
    api.login.mockRejectedValue(new ApiClientError('Invalid username or password', { status: 401 }));
    renderLogin();
    await userEvent.type(screen.getByLabelText('Username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password');
    expect(screen.getByLabelText('Username')).toHaveValue('admin');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('falls back to a generic message for unexpected errors', async () => {
    api.login.mockRejectedValue(new Error('boom'));
    renderLogin();
    await userEvent.type(screen.getByLabelText('Username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign in. Please try again.');
  });

  it('disables the button while signing in so it cannot be double-submitted', async () => {
    let resolve!: (v: typeof session) => void;
    api.login.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderLogin();
    await userEvent.type(screen.getByLabelText('Username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const busy = screen.getByRole('button', { name: 'Signing in…' });
    expect(busy).toBeDisabled();
    resolve(session);
    await waitFor(() => expect(api.login).toHaveBeenCalledTimes(1));
  });

  it('toggles password visibility', async () => {
    renderLogin();
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('redirects an already signed-in user away from the login page', () => {
    setAuth('authenticated');
    renderLogin();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
  });

  it('sends the user back to the page they originally asked for after signing in', async () => {
    api.login.mockImplementation(async () => {
      setAuth('authenticated');
      return session;
    });
    renderLogin('/login', { from: '/invoices' });
    await userEvent.type(screen.getByLabelText('Username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/invoices');
  });
});

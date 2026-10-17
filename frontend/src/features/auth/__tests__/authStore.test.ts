import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { queryClient } from '@/lib/queryClient';
import { notifyUnauthorized } from '@/lib/authEvents';
import { setAuth, testUser } from '@/__tests__/utils';

vi.mock('../services/authService', () => ({
  authService: { me: vi.fn(), login: vi.fn(), logout: vi.fn(), updateProfile: vi.fn(), changePassword: vi.fn(), signOutEverywhere: vi.fn() },
}));
const api = vi.mocked(authService);

beforeEach(() => {
  vi.clearAllMocks();
  api.logout.mockResolvedValue(undefined);
  setAuth('loading');
});

describe('authStore.bootstrap', () => {
  it('becomes authenticated when the server accepts the session cookie', async () => {
    api.me.mockResolvedValue({ user: testUser, rememberMe: true, expiresAt: '2030-01-01T00:00:00.000Z' });
    await useAuthStore.getState().bootstrap();
    const s = useAuthStore.getState();
    expect(s.status).toBe('authenticated');
    expect(s.user?.username).toBe('admin');
    expect(s.rememberMe).toBe(true);
    expect(s.expiresAt).toBe('2030-01-01T00:00:00.000Z');
  });

  it('becomes unauthenticated when there is no valid session', async () => {
    api.me.mockRejectedValue(new Error('401'));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('authStore.login / logout', () => {
  it('login stores the user and session info, and keeps the token out of the store and storage', async () => {
    api.login.mockResolvedValue({ user: testUser, rememberMe: true, expiresAt: '2030-01-01T00:00:00.000Z' });
    await useAuthStore.getState().login({ username: 'admin', password: 'pw', rememberMe: true });
    expect(api.login).toHaveBeenCalledWith({ username: 'admin', password: 'pw', rememberMe: true });
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(JSON.stringify(useAuthStore.getState())).not.toMatch(/token/i);
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('a failed login leaves the user signed out', async () => {
    api.login.mockRejectedValue(new Error('Invalid username or password'));
    await expect(useAuthStore.getState().login({ username: 'a', password: 'b', rememberMe: false })).rejects.toThrow();
    expect(useAuthStore.getState().status).not.toBe('authenticated');
  });

  it('logout tells the server, wipes cached data and clears the user', () => {
    setAuth('authenticated');
    queryClient.setQueryData(['invoices'], [{ id: 1 }]);
    useAuthStore.getState().logout();
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['invoices'])).toBeUndefined();
    expect(useAuthStore.getState()).toMatchObject({ status: 'unauthenticated', user: null, expiresAt: null });
  });

  it('logout still signs out locally if the server call fails', async () => {
    api.logout.mockRejectedValue(new Error('network'));
    setAuth('authenticated');
    useAuthStore.getState().logout();
    await Promise.resolve();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});

describe('server-rejected sessions (401 event)', () => {
  it('signs out an authenticated user', () => {
    setAuth('authenticated');
    notifyUnauthorized();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('does nothing when already signed out (no logout loop)', () => {
    setAuth('unauthenticated');
    notifyUnauthorized();
    expect(api.logout).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from '../pages/ProfilePage';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { renderRoutes, setAuth, testUser } from '@/__tests__/utils';

vi.mock('../services/authService', () => ({
  authService: { updateProfile: vi.fn(), changePassword: vi.fn(), signOutEverywhere: vi.fn(), logout: vi.fn() },
}));
const api = vi.mocked(authService);

const renderProfile = () => renderRoutes(<ProfilePage />, { route: '/profile', path: '/profile' });

beforeEach(() => {
  vi.clearAllMocks();
  api.logout.mockResolvedValue(undefined);
  setAuth('authenticated');
});

describe('ProfilePage — account details', () => {
  it('shows the account info with a read-only username', () => {
    renderProfile();
    expect(screen.getByRole('heading', { name: 'My Profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Display name')).toHaveValue('Administrator');
    expect(screen.getByLabelText('Email (optional)')).toHaveValue('admin@example.com');
  });

  it('keeps Save disabled until something changes', async () => {
    renderProfile();
    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Display name'), ' II');
    expect(save).toBeEnabled();
  });

  it('saves and updates the store (and so the avatar/menu)', async () => {
    api.updateProfile.mockResolvedValue({ ...testUser, displayName: 'Basit' });
    renderProfile();
    const name = screen.getByLabelText('Display name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Basit');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ displayName: 'Basit', email: 'admin@example.com' }));
    await waitFor(() => expect(useAuthStore.getState().user?.displayName).toBe('Basit'));
  });
});

describe('ProfilePage — change password', () => {
  const fill = async (current: string, next: string, confirm: string) => {
    await userEvent.type(screen.getByLabelText('Current password'), current);
    await userEvent.type(screen.getByLabelText('New password'), next);
    await userEvent.type(screen.getByLabelText('Confirm new password'), confirm);
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
  };

  it('needs the current and new password before the button enables', async () => {
    renderProfile();
    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled();
  });

  it('rejects a confirmation that does not match, without calling the server', async () => {
    renderProfile();
    await fill('Old-pass-1', 'New-pass-123', 'New-pass-124');
    expect(screen.getByRole('alert')).toHaveTextContent('do not match');
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it.each([
    ['short1', 'at least 8'],
    ['onlyletterslong', 'number'],
    ['1234567890', 'letter'],
  ])('rejects the weak password "%s" client-side', async (weak, message) => {
    renderProfile();
    await fill('Old-pass-1', weak, weak);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('shows the server error for a wrong current password', async () => {
    api.changePassword.mockRejectedValue(new Error('Current password is incorrect'));
    renderProfile();
    await fill('wrong-pass-1', 'New-pass-123', 'New-pass-123');
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
  });

  it('changes the password, clears the form and keeps this session signed in', async () => {
    api.changePassword.mockResolvedValue({ user: testUser, rememberMe: false, expiresAt: '2099-02-02T00:00:00.000Z' });
    renderProfile();
    await fill('Old-pass-1', 'New-pass-123', 'New-pass-123');
    await waitFor(() => expect(api.changePassword).toHaveBeenCalledWith({ currentPassword: 'Old-pass-1', newPassword: 'New-pass-123' }));
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveValue(''));
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().expiresAt).toBe('2099-02-02T00:00:00.000Z');
  });

  it('can reveal the typed passwords', async () => {
    renderProfile();
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: /show passwords/i }));
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text');
  });
});

describe('ProfilePage — session', () => {
  it('describes a browser-session sign-in', () => {
    renderProfile();
    expect(screen.getByText('This browser session only')).toBeInTheDocument();
  });

  it('describes a 7-day sign-in when "keep me signed in" was used', () => {
    setAuth('authenticated', { rememberMe: true });
    renderProfile();
    expect(screen.getByText('Kept signed in (7 days)')).toBeInTheDocument();
  });

  it('signs out and goes to /login', async () => {
    renderProfile();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('"Sign out of all devices" asks first, and does nothing if cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderProfile();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out of all devices' }));
    expect(api.signOutEverywhere).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('"Sign out of all devices" revokes every session and signs out here', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.signOutEverywhere.mockResolvedValue(undefined);
    renderProfile();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out of all devices' }));
    await waitFor(() => expect(api.signOutEverywhere).toHaveBeenCalled());
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});

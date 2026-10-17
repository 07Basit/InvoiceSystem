import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from '../pages/ProfilePage';
import { authService } from '../services/authService';
import { signService, type SignProfile } from '@/features/invoices/services/signService';
import { bankService, type BankProfile } from '@/features/invoices/services/bankService';
import { exporterService, type ExporterProfile } from '@/features/invoices/services/exporterService';
import { useAuthStore } from '../store/authStore';
import { renderRoutes, setAuth, testUser } from '@/__tests__/utils';

vi.mock('../services/authService', () => ({
  authService: { updateProfile: vi.fn(), changePassword: vi.fn(), signOutEverywhere: vi.fn(), logout: vi.fn() },
}));
vi.mock('@/features/invoices/services/exporterService', () => ({
  exporterService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setDefault: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/features/invoices/services/bankService', () => ({
  bankService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setDefault: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/features/invoices/services/signService', () => ({
  signService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setDefault: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
}));
const api = vi.mocked(authService);
const exporters = vi.mocked(exporterService);
const banks = vi.mocked(bankService);
const signs = vi.mocked(signService);

const sign = (over: Partial<SignProfile> = {}): SignProfile => ({
  id: 's1', name: 'Proprietor sign', image: 'data:image/png;base64,AAAA', isDefault: true, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const signList = (...data: SignProfile[]) => ({ success: true as const, data, error: null, meta: null });

const bank = (over: Partial<BankProfile> = {}): BankProfile => ({
  id: 'b1', bankName: 'HDFC BANK', accountNumber: '5036834342323', ifscCode: 'HDFC45300321', swiftCode: null, isDefault: true, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const bankList = (...data: BankProfile[]) => ({ success: true as const, data, error: null, meta: null });

const profile = (over: Partial<ExporterProfile> = {}): ExporterProfile => ({
  id: 'e1', name: 'Green Harvest', address: '1 Dock Rd', contact: '+91 90000 10000', email: null, isDefault: true, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const listOf = (...data: ExporterProfile[]) => ({ success: true as const, data, error: null, meta: null });

const renderProfile = () => renderRoutes(<ProfilePage />, { route: '/profile', path: '/profile' });

beforeEach(() => {
  vi.clearAllMocks();
  api.logout.mockResolvedValue(undefined);
  exporters.list.mockResolvedValue(listOf());
  banks.list.mockResolvedValue(bankList());
  signs.list.mockResolvedValue(signList());
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

describe('ProfilePage — exporter profiles', () => {
  it('lists profiles and marks the default', async () => {
    exporters.list.mockResolvedValue(listOf(profile(), profile({ id: 'e2', name: 'Blue Exports', isDefault: false })));
    renderProfile();
    expect(await screen.findByText('Blue Exports')).toBeInTheDocument();
    expect(screen.getByText('Green Harvest')).toBeInTheDocument();
    expect(screen.getAllByText('Default')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Make Blue Exports the default' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make Green Harvest the default' })).not.toBeInTheDocument();
  });

  it('invites you to add the first profile when there are none', async () => {
    renderProfile();
    expect(await screen.findByText('No exporter profiles yet')).toBeInTheDocument();
  });

  it('validates before calling the server', async () => {
    renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: /add profile/i }));
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));
    expect(await screen.findByText('Exporter name is required')).toBeInTheDocument();
    expect(exporters.create).not.toHaveBeenCalled();
  });

  it('creates a profile', async () => {
    exporters.create.mockResolvedValue({ success: true, data: profile(), error: null, meta: null });
    renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: /add profile/i }));
    await userEvent.type(screen.getByLabelText('Exporter name'), 'Green Harvest');
    await userEvent.type(screen.getByLabelText('Contact'), '+91 90000 10000');
    await userEvent.type(screen.getByLabelText('Address'), '1 Dock Rd');
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));
    await waitFor(() => expect(exporters.create).toHaveBeenCalledWith({ name: 'Green Harvest', address: '1 Dock Rd', contact: '+91 90000 10000' }));
  });

  it('marks a profile as not needed, and brings it back', async () => {
    exporters.list.mockResolvedValue(listOf(profile(), profile({ id: 'e2', name: 'Blue Exports', isDefault: false, isActive: false })));
    exporters.setActive.mockResolvedValue({ success: true, data: profile(), error: null, meta: null });
    renderProfile();
    expect(await screen.findByText('Not needed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make Blue Exports the default' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Make Blue Exports active again' }));
    await waitFor(() => expect(exporters.setActive).toHaveBeenCalledWith('e2', true));
    await userEvent.click(screen.getByRole('button', { name: 'Mark Green Harvest as not needed' }));
    await waitFor(() => expect(exporters.setActive).toHaveBeenCalledWith('e1', false));
  });

  it('changes the default', async () => {
    exporters.list.mockResolvedValue(listOf(profile(), profile({ id: 'e2', name: 'Blue Exports', isDefault: false })));
    exporters.setDefault.mockResolvedValue({ success: true, data: profile({ id: 'e2', isDefault: true }), error: null, meta: null });
    renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: 'Make Blue Exports the default' }));
    await waitFor(() => expect(exporters.setDefault).toHaveBeenCalledWith('e2'));
  });
});

describe('ProfilePage — bank accounts', () => {
  it('lists accounts with the default, not-needed badge and no star on an inactive one', async () => {
    banks.list.mockResolvedValue(bankList(bank(), bank({ id: 'b2', bankName: 'ICICI BANK', accountNumber: '111122223333', isDefault: false, isActive: false })));
    renderProfile();
    expect(await screen.findByText('ICICI BANK')).toBeInTheDocument();
    expect(screen.getByText('HDFC BANK')).toBeInTheDocument();
    expect(screen.getByText('Not needed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Make ICICI BANK ending 3333 the default/ })).not.toBeInTheDocument();
  });

  it('validates, then creates an account', async () => {
    banks.create.mockResolvedValue({ success: true, data: bank(), error: null, meta: null });
    renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: /add account/i }));
    await userEvent.click(screen.getByRole('button', { name: /save account/i }));
    expect(await screen.findByText('Bank name is required')).toBeInTheDocument();
    expect(banks.create).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Bank name'), 'HDFC BANK');
    await userEvent.type(screen.getByLabelText('Account number'), '5036834342323');
    await userEvent.click(screen.getByRole('button', { name: /save account/i }));
    await waitFor(() => expect(banks.create).toHaveBeenCalledWith({ bankName: 'HDFC BANK', accountNumber: '5036834342323' }));
  });

  it('marks an account as not needed', async () => {
    banks.list.mockResolvedValue(bankList(bank()));
    banks.setActive.mockResolvedValue({ success: true, data: bank(), error: null, meta: null });
    renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: /Mark HDFC BANK ending 2323 as not needed/ }));
    await waitFor(() => expect(banks.setActive).toHaveBeenCalledWith('b1', false));
  });
});

describe('ProfilePage — seal & sign', () => {
  it('lists signs with previews, the default badge and a not-needed one', async () => {
    signs.list.mockResolvedValue(signList(sign(), sign({ id: 's2', name: 'Company seal', isDefault: false, isActive: false })));
    renderProfile();
    expect(await screen.findByText('Company seal')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Proprietor sign preview' })).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    expect(screen.getAllByText('Default').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Make Company seal active again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make Company seal the default seal and sign' })).not.toBeInTheDocument();
  });

  it('needs a name and an image before saving', async () => {
    renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: /add seal & sign/i }));
    await userEvent.click(screen.getByRole('button', { name: /save seal & sign/i }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Choose an image.')).toBeInTheDocument();
    expect(signs.create).not.toHaveBeenCalled();
  });

  it('marks a sign as not needed', async () => {
    signs.list.mockResolvedValue(signList(sign()));
    signs.setActive.mockResolvedValue({ success: true, data: sign(), error: null, meta: null });
    renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark Proprietor sign as not needed' }));
    await waitFor(() => expect(signs.setActive).toHaveBeenCalledWith('s1', false));
  });
});

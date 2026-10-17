import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UserMenu from '../components/UserMenu';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { LocationProbe, setAuth } from '@/__tests__/utils';

vi.mock('../services/authService', () => ({ authService: { logout: vi.fn() } }));

const renderMenu = () =>
  render(
    <MemoryRouter initialEntries={['/invoices']}>
      <Routes>
        <Route path="/invoices" element={<UserMenu />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authService.logout).mockResolvedValue(undefined);
  setAuth('authenticated');
});

describe('UserMenu', () => {
  it('shows the user initial on the avatar and keeps the menu closed', () => {
    renderMenu();
    const button = screen.getByRole('button', { name: 'Account menu' });
    expect(button).toHaveTextContent('A');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens with name, username, profile link and sign out', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.getByText('@admin')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /my profile/i })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
  });

  it('closes on Escape and on an outside click', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('signing out clears the session and goes to /login', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(authService.logout).toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });
});

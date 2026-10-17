import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationBell from '../components/NotificationBell';
import { notificationService } from '../services/notificationService';
import { make, page, renderWithApp } from './helpers';

vi.mock('../services/notificationService', () => ({
  notificationService: {
    list: vi.fn(), unreadCount: vi.fn(), getOne: vi.fn(), markRead: vi.fn(), markUnread: vi.fn(), markAllRead: vi.fn(), remove: vi.fn(), clearRead: vi.fn(),
  },
}));
const svc = vi.mocked(notificationService);

beforeEach(() => {
  vi.clearAllMocks();
  svc.unreadCount.mockResolvedValue(3);
  svc.list.mockResolvedValue(page([
    make({ id: 'a', title: 'Invoice A created' }),
    make({ id: 'b', title: 'Invoice B updated', type: 'info', readAt: new Date().toISOString() }),
  ]) as never);
  svc.markRead.mockResolvedValue(make() as never);
  svc.markAllRead.mockResolvedValue(undefined as never);
});

const open = async () => {
  const user = userEvent.setup();
  renderWithApp(<NotificationBell />);
  await user.click(await screen.findByRole('button', { name: /Notifications, 3 unread/ }));
  return user;
};

describe('NotificationBell', () => {
  it('shows the unread count from the server on the bell', async () => {
    renderWithApp(<NotificationBell />);
    expect(await screen.findByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows no badge when everything is read', async () => {
    svc.unreadCount.mockResolvedValue(0);
    renderWithApp(<NotificationBell />);
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('caps the badge at 9+', async () => {
    svc.unreadCount.mockResolvedValue(42);
    renderWithApp(<NotificationBell />);
    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  it('only loads the list once the bell is opened, and asks for the latest five', async () => {
    renderWithApp(<NotificationBell />);
    await screen.findByRole('button', { name: /Notifications/ });
    expect(svc.list).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    await screen.findByText('Invoice A created');
    expect(svc.list).toHaveBeenCalledWith({ page: 1, limit: 5, status: 'all' });
  });

  it('lists notifications with their messages and a link to see them all', async () => {
    await open();
    expect(await screen.findByText('Invoice A created')).toBeInTheDocument();
    expect(screen.getByText('Invoice B updated')).toBeInTheDocument();
    expect(screen.getAllByText('INV-1 for ABC, USD 100.00')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'View all notifications' })).toHaveAttribute('href', '/notifications');
    expect(screen.getAllByLabelText('Unread')).toHaveLength(1); // only the unread one has the dot
  });

  it('opening an item goes to its detail page (which is what marks it read, once)', async () => {
    const user = await open();
    await user.click(await screen.findByText('Invoice A created'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/notifications/a');
    expect(svc.markRead).not.toHaveBeenCalled();
  });

  it('opens an item that is already read the same way', async () => {
    const user = await open();
    await user.click(await screen.findByText('Invoice B updated'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/notifications/b');
    expect(svc.markRead).not.toHaveBeenCalled();
  });

  it('marks everything read from the dropdown', async () => {
    const user = await open();
    await user.click(await screen.findByRole('button', { name: /Mark all read/ }));
    await waitFor(() => expect(svc.markAllRead).toHaveBeenCalled());
  });

  it('shows an empty state when there is nothing yet', async () => {
    svc.list.mockResolvedValue(page([]) as never);
    await open();
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = await open();
    await screen.findByText('Invoice A created');
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Invoice A created')).not.toBeInTheDocument();
  });

  it('fits the screen on a phone (spans it with a margin) and hangs from the bell on wider screens', async () => {
    await open();
    const dropdown = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(dropdown.className).toContain('fixed');
    expect(dropdown.className).toContain('inset-x-3');
    expect(dropdown.className).toContain('sm:absolute');
    expect(dropdown.className).toContain('sm:right-0');
  });
});

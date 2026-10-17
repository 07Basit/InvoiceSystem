import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationsPage from '../pages/NotificationsPage';
import NotificationDetailPage from '../pages/NotificationDetailPage';
import NotificationRow from '../components/NotificationRow';
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
  svc.unreadCount.mockResolvedValue(2);
  svc.markRead.mockResolvedValue(make() as never);
  svc.markUnread.mockResolvedValue(make() as never);
  svc.markAllRead.mockResolvedValue(undefined as never);
  svc.remove.mockResolvedValue(undefined as never);
  svc.clearRead.mockResolvedValue(1 as never);
});

describe('NotificationRow', () => {
  const handlers = () => ({ onOpen: vi.fn(), onToggleRead: vi.fn(), onDelete: vi.fn() });

  it('highlights an unread notification and offers "mark as read"', () => {
    render(<NotificationRow notification={make()} {...handlers()} />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeInTheDocument();
    expect(screen.getByText('by Basit')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });

  it('a read one offers "mark as unread" and has no "New" tag', () => {
    render(<NotificationRow notification={make({ readAt: new Date().toISOString() })} {...handlers()} />);
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as unread' })).toBeInTheDocument();
  });

  it('row actions do not also open the notification', async () => {
    const h = handlers();
    render(<NotificationRow notification={make()} {...h} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete notification' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(h.onDelete).toHaveBeenCalledTimes(1);
    expect(h.onToggleRead).toHaveBeenCalledTimes(1);
    expect(h.onOpen).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('Invoice INV-1 created'));
    expect(h.onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationsPage', () => {
  it('lists notifications from the server, 10 per page, newest first as returned', async () => {
    svc.list.mockResolvedValue(page([make({ id: 'a', title: 'First one' }), make({ id: 'b', title: 'Second one' })]) as never);
    renderWithApp(<NotificationsPage />);
    expect(await screen.findByText('First one')).toBeInTheDocument();
    expect(screen.getByText('Second one')).toBeInTheDocument();
    expect(svc.list).toHaveBeenCalledWith({ page: 1, limit: 10, status: 'all' });
    expect(screen.getByText(/2 unread/)).toBeInTheDocument();
  });

  it('filters to unread and by category through the server', async () => {
    svc.list.mockResolvedValue(page([]) as never);
    renderWithApp(<NotificationsPage />);
    const user = userEvent.setup();
    await screen.findByText('No notifications yet');

    await user.click(screen.getByRole('button', { name: /unread/i }));
    await waitFor(() => expect(svc.list).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: 'unread' }));
    await user.click(screen.getByRole('button', { name: 'Currency' }));
    await waitFor(() => expect(svc.list).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: 'unread', category: 'currency' }));
    expect(await screen.findByText('No notifications match')).toBeInTheDocument();
  });

  it('marks all as read, and disables the button when nothing is unread', async () => {
    svc.list.mockResolvedValue(page([make()]) as never);
    renderWithApp(<NotificationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Mark all as read/ }));
    await waitFor(() => expect(svc.markAllRead).toHaveBeenCalled());
  });

  it('opens a notification on click (the detail page then marks it read)', async () => {
    svc.list.mockResolvedValue(page([make({ id: 'abc', title: 'Open me' })]) as never);
    renderWithApp(<NotificationsPage />);
    await userEvent.click(await screen.findByText('Open me'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/notifications/abc');
    expect(svc.markRead).not.toHaveBeenCalled();
  });

  it('asks before clearing read notifications', async () => {
    svc.list.mockResolvedValue(page([make({ readAt: new Date().toISOString() })]) as never);
    renderWithApp(<NotificationsPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Clear read/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Unread ones are kept');
    expect(svc.clearRead).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Clear read' }));
    await waitFor(() => expect(svc.clearRead).toHaveBeenCalled());
  });
});

describe('NotificationDetailPage', () => {
  const renderDetail = () => renderWithApp(<NotificationDetailPage />, { route: '/notifications/n1', path: '/notifications/:id' });

  it('shows the full information: title, who, message, details and the link to the record', async () => {
    svc.getOne.mockResolvedValue(make() as never);
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Invoice INV-1 created' })).toBeInTheDocument();
    expect(screen.getByText(/by Basit/)).toBeInTheDocument();
    expect(screen.getByText('INV-1 for ABC, USD 100.00')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('USD 100.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open invoice/ })).toHaveAttribute('href', '/invoices/inv1');
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });

  it('marks an unread notification as read when you open it', async () => {
    svc.getOne.mockResolvedValue(make() as never);
    renderDetail();
    await screen.findByRole('heading', { name: 'Invoice INV-1 created' });
    await waitFor(() => expect(svc.markRead).toHaveBeenCalledWith('n1'));
  });

  it('leaves an already-read notification alone', async () => {
    svc.getOne.mockResolvedValue(make({ readAt: new Date().toISOString() }) as never);
    renderDetail();
    await screen.findByRole('heading', { name: 'Invoice INV-1 created' });
    expect(svc.markRead).not.toHaveBeenCalled();
  });

  it('has no open button when there is no link', async () => {
    svc.getOne.mockResolvedValue(make({ link: null, linkLabel: null, details: [] }) as never);
    renderDetail();
    await screen.findByRole('heading', { name: 'Invoice INV-1 created' });
    expect(screen.queryByRole('link', { name: /Open/ })).not.toBeInTheDocument();
  });

  it('can be marked unread or deleted, then returns to the list', async () => {
    svc.getOne.mockResolvedValue(make({ readAt: new Date().toISOString() }) as never);
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: /Delete/ }));
    await waitFor(() => expect(svc.remove).toHaveBeenCalledWith('n1'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/notifications');
  });

  it('says so when the notification does not exist', async () => {
    svc.getOne.mockRejectedValue(new Error('404'));
    renderDetail();
    expect(await screen.findByText('Notification not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to notifications' })).toHaveAttribute('href', '/notifications');
  });
});

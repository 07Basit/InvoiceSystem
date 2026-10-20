import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import type { NotificationCategory } from 'shared';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import { useConfirm } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { categoryLabel } from '@/lib/notifications';
import { scrollMainToTop } from '@/lib/pagination';
import NotificationRow from '../components/NotificationRow';
import {
  useClearRead, useDeleteNotification, useMarkAllRead, useMarkRead, useMarkUnread, useNotifications, useUnreadCount,
} from '../hooks/useNotifications';

const PAGE_SIZE = 10;
const categories: Array<NotificationCategory | 'all'> = ['all', 'invoice', 'importer', 'currency'];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [status, setStatus] = useState<'all' | 'unread'>('all');
  const [category, setCategory] = useState<NotificationCategory | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useNotifications({
    page, limit: PAGE_SIZE, status, ...(category !== 'all' ? { category } : {}),
  });
  const { data: unread = 0 } = useUnreadCount();
  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const markAll = useMarkAllRead();
  const remove = useDeleteNotification();
  const clearRead = useClearRead();

  const items = data?.data ?? [];
  const meta = data?.meta;

  // After deleting the last item on the last page, step back.
  const totalPages = meta?.totalPages ?? 0;
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const change = <T,>(setter: (v: T) => void) => (value: T) => { setter(value); setPage(1); };

  const clearAllRead = async () => {
    const ok = await confirm({
      title: 'Clear read notifications?',
      message: 'Every notification you have already read will be deleted. Unread ones are kept.',
      confirmLabel: 'Clear read',
      destructive: true,
    });
    if (!ok) return;
    clearRead.mutate(undefined, { onSuccess: () => showToast('Notifications cleared', 'Read notifications were deleted.', 'success') });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : 'You are all caught up'}. Activity on invoices, importers and exchange rates shows up here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => markAll.mutate(undefined)} disabled={unread === 0 || markAll.isPending} className="btn-ghost text-xs disabled:opacity-50">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
          </button>
          <button onClick={clearAllRead} disabled={clearRead.isPending} className="btn-ghost text-xs">
            <Trash2 className="h-3.5 w-3.5" /> Clear read
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by status" className="inline-flex w-fit rounded-lg border bg-muted/40 p-0.5">
          {(['all', 'unread'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => change(setStatus)(s)}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors', status === s ? 'bg-[hsl(var(--brand-accent))] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {s}{s === 'unread' && unread > 0 ? ` ${unread}` : ''}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => change(setCategory)(c)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                category === c ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent))]/10 text-[hsl(var(--brand-accent))]' : 'bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {c === 'all' ? 'All types' : categoryLabel[c]}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-16"><LoadingSpinner variant="notifications" /></div>}

      {isError && (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">Failed to load notifications.</p>
          <button onClick={() => refetch()} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Retry</button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60"><Bell className="h-6 w-6 text-muted-foreground/50" /></div>
          <p className="text-sm font-semibold">{status === 'unread' || category !== 'all' ? 'No notifications match' : 'No notifications yet'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {status === 'unread' || category !== 'all' ? 'Try another filter.' : 'They appear here when invoices or importers are created, changed or deleted.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((n) => (
          <NotificationRow
            key={n.id}
            notification={n}
            onOpen={() => navigate(`/notifications/${n.id}`)} // the detail page marks it as read
            onToggleRead={() => (n.readAt ? markUnread.mutate(n.id) : markRead.mutate(n.id))}
            onDelete={() => remove.mutate(n.id)}
          />
        ))}
      </div>

      {meta && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.limit} onPageChange={(p) => { setPage(p); scrollMainToTop(); }} noun="notifications" />
      )}
    </div>
  );
}

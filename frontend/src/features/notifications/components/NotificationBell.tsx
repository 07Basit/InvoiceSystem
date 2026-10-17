import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationDto } from 'shared';
import { cn } from '@/lib/utils';
import { timeAgo, typeStyle } from '@/lib/notifications';
import { useMarkAllRead, useNotifications, useUnreadCount } from '../hooks/useNotifications';

/** The bell in the top bar: unread badge, the latest few notifications, and a link to the full page. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: unread = 0 } = useUnreadCount();
  const { data, isLoading } = useNotifications({ page: 1, limit: 5, status: 'all' }, open);
  const markAll = useMarkAllRead();
  const items = data?.data ?? [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (n: NotificationDto) => {
    setOpen(false);
    navigate(`/notifications/${n.id}`); // the detail page marks it as read
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        className="relative btn-icon"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-[hsl(var(--brand-accent))] px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-xl border bg-card shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem]" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b bg-secondary/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <span className="rounded-full bg-[hsl(var(--brand-accent))]/10 px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--brand-accent))]">{unread} new</span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={() => markAll.mutate(undefined)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="mb-2 h-6 w-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No notifications yet.</p>
              </div>
            ) : (
              items.map((n) => {
                const { icon: Icon, iconClass } = typeStyle[n.type];
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={cn('flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/40', !n.readAt && 'bg-[hsl(var(--brand-accent))]/5')}
                  >
                    <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', iconClass)}><Icon className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={cn('text-xs leading-snug', !n.readAt ? 'font-semibold' : 'font-medium')}>{n.title}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </span>
                      {n.message ? <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">{n.message}</span> : null}
                    </span>
                    {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--brand-accent))]" aria-label="Unread" />}
                  </button>
                );
              })
            )}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t bg-secondary/30 px-4 py-2.5 text-center text-xs font-semibold text-[hsl(var(--brand-accent))] hover:bg-secondary/60"
          >
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}

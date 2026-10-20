import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, EyeOff, Trash2 } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { cn } from '@/lib/utils';
import { categoryLabel, formatDateTime, timeAgo, typeStyle } from '@/lib/notifications';
import { useDeleteNotification, useMarkRead, useMarkUnread, useNotification } from '../hooks/useNotifications';

export default function NotificationDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: n, isLoading, isError } = useNotification(id);
  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const remove = useDeleteNotification();

  // Opening a notification counts as reading it.
  const needsRead = !!n && !n.readAt;
  useEffect(() => {
    if (needsRead) markRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsRead, id]);

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner variant="notifications" /></div>;
  if (isError || !n) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-16 text-center">
        <p className="font-semibold">Notification not found</p>
        <p className="text-sm text-muted-foreground">It may have been deleted.</p>
        <Link to="/notifications" className="text-sm font-semibold underline">Back to notifications</Link>
      </div>
    );
  }

  const { icon: Icon, iconClass, badgeClass, label } = typeStyle[n.type];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Breadcrumbs items={[{ label: 'Notifications', to: '/notifications' }, { label: n.title }]} />

      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', iconClass)}><Icon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', badgeClass)}>{label}</span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{categoryLabel[n.category]}</span>
            </div>
            <h1 className="mt-2 text-xl font-bold leading-snug sm:text-2xl">{n.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateTime(n.createdAt)} <span aria-hidden>·</span> {timeAgo(n.createdAt)}
              {n.actorName ? <> <span aria-hidden>·</span> by {n.actorName}</> : null}
            </p>
          </div>
        </div>

        {n.message ? <p className="mt-5 text-[15px] leading-relaxed">{n.message}</p> : null}

        {n.details.length > 0 && (
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
            {n.details.map((d) => (
              <div key={d.label}>
                <dt className="text-xs font-medium text-muted-foreground">{d.label}</dt>
                <dd className="mt-0.5 break-words text-sm font-medium">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {n.link && (
            <Link to={n.link} className="btn-brand text-sm">
              <ExternalLink className="h-4 w-4" /> {n.linkLabel ?? 'Open'}
            </Link>
          )}
          <button onClick={() => markUnread.mutate(id, { onSuccess: () => navigate('/notifications') })} className="btn-ghost text-sm">
            <EyeOff className="h-4 w-4" /> Mark as unread
          </button>
          <button onClick={() => remove.mutate(id, { onSuccess: () => navigate('/notifications') })} className="btn-ghost text-sm text-destructive">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

import { Eye, EyeOff, Trash2 } from 'lucide-react';
import type { NotificationDto } from 'shared';
import Tooltip from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { categoryLabel, formatDateTime, timeAgo, typeStyle } from '@/lib/notifications';

interface NotificationRowProps {
  notification: NotificationDto;
  onOpen: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
}

export default function NotificationRow({ notification: n, onOpen, onToggleRead, onDelete }: NotificationRowProps) {
  const { icon: Icon, iconClass } = typeStyle[n.type];
  const unread = !n.readAt;

  return (
    <div
      onClick={onOpen}
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 transition-all hover:border-[hsl(var(--brand-accent))]/40 hover:shadow-sm',
        unread && 'border-[hsl(var(--brand-accent))]/30 bg-[hsl(var(--brand-accent))]/5',
      )}
    >
      <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', iconClass)}><Icon className="h-4 w-4" /></span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className={cn('text-sm leading-snug', unread ? 'font-semibold' : 'font-medium')}>{n.title}</p>
          <span className="shrink-0 text-xs text-muted-foreground" title={formatDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</span>
        </div>
        {n.message ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.message}</p> : null}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{categoryLabel[n.category]}</span>
          {n.actorName ? <span>by {n.actorName}</span> : null}
          {unread ? <span className="font-semibold text-[hsl(var(--brand-accent))]">New</span> : null}
        </p>
      </div>

      <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
        <Tooltip label={unread ? 'Mark as read' : 'Mark as unread'} align="end">
          <button onClick={onToggleRead} aria-label={unread ? 'Mark as read' : 'Mark as unread'} className="rounded-md p-2 hover:bg-accent">
            {unread ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </Tooltip>
        <Tooltip label="Delete notification" align="end">
          <button onClick={onDelete} aria-label="Delete notification" className="rounded-md p-2 hover:bg-destructive/10">
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

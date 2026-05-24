import { useEffect, useRef, useState } from 'react';
import { Bell, Menu, Search } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface TopBarProps {
  onOpenMobileSidebar: () => void;
}

export default function TopBar({ onOpenMobileSidebar }: TopBarProps) {
  const { activeCount, notifications, markAllAsSeen } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      markAllAsSeen();
    }
  }, [isOpen, markAllAsSeen]);

  const getTimeAgo = (createdAt: number) => {
    const diffMs = Date.now() - createdAt;
    const diffSec = Math.max(1, Math.floor(diffMs / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  const getToneClass = (title: string, message: string | undefined, type: 'success' | 'error' | 'info') => {
    const text = `${title} ${message ?? ''}`.toLowerCase();
    if (text.includes('delete') || text.includes('removed')) return 'text-red-600';
    if (type === 'success') return 'text-green-600';
    if (type === 'error') return 'text-red-600';
    return 'text-slate-500';
  };

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3 text-muted-foreground min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 rounded-md hover:bg-accent transition-colors md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Search className="h-4 w-4" />
        <span className="text-sm truncate">Search...</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative" ref={panelRef}>
          <button
            className="relative p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Notifications"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <Bell className="h-4 w-4 text-muted-foreground" />
            {activeCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 text-center">
                {activeCount > 9 ? '9+' : activeCount}
              </span>
            ) : null}
          </button>

          {isOpen ? (
            <div className="absolute right-0 top-11 w-64 sm:w-72 max-w-[86vw] rounded-lg border bg-card shadow-lg z-50">
              <div className="px-2.5 py-2 border-b">
                <p className="text-xs font-semibold">Notifications</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2.5 py-3">No notifications yet.</p>
                ) : (
                  notifications.slice(0, 5).map((notification) => (
                    <div key={notification.id} className="px-2.5 py-2 border-b last:border-b-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[10px] font-semibold uppercase tracking-wide ${getToneClass(notification.title, notification.message, notification.type)}`}>
                          {notification.type}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{getTimeAgo(notification.createdAt)}</p>
                      </div>
                      <p className="text-xs font-medium mt-0.5">{notification.title}</p>
                      {notification.message ? <p className="text-[11px] text-muted-foreground mt-0.5 leading-4">{notification.message}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
          U
        </div>
      </div>
    </header>
  );
}

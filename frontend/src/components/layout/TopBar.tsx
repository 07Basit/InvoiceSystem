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
    <header className="h-16 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="btn-icon md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="hidden sm:flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-1.5 w-56 lg:w-72">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Quick search…</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative" ref={panelRef}>
          <button
            className="relative btn-icon"
            aria-label="Notifications"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <Bell className="h-4 w-4" />
            {activeCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[hsl(var(--brand-accent))] text-white text-[10px] leading-4 text-center font-semibold">
                {activeCount > 9 ? '9+' : activeCount}
              </span>
            ) : null}
          </button>

          {isOpen ? (
            <div className="absolute right-0 top-12 w-72 max-w-[90vw] rounded-xl border bg-card shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b bg-secondary/30 flex items-center justify-between">
                <p className="text-sm font-semibold">Notifications</p>
                {notifications.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--brand-accent))]/10 text-[hsl(var(--brand-accent))] font-semibold">
                    {notifications.length}
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Bell className="h-6 w-6 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">No notifications yet.</p>
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notification) => (
                    <div key={notification.id} className="px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${getToneClass(notification.title, notification.message, notification.type)}`}>
                          {notification.type}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{getTimeAgo(notification.createdAt)}</p>
                      </div>
                      <p className="text-xs font-semibold">{notification.title}</p>
                      {notification.message ? <p className="text-[11px] text-muted-foreground mt-0.5 leading-4">{notification.message}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-xs font-bold ring-2 ring-[hsl(var(--primary))]/20">
          U
        </div>
      </div>
    </header>
  );
}

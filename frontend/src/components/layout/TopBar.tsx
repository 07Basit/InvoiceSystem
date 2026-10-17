import { Menu, Search } from 'lucide-react';
import UserMenu from '@/features/auth/components/UserMenu';
import NotificationBell from '@/features/notifications/components/NotificationBell';

interface TopBarProps {
  onOpenMobileSidebar: () => void;
}

export default function TopBar({ onOpenMobileSidebar }: TopBarProps) {
  return (
    <header className="h-16 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="btn-icon lg:hidden"
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
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}

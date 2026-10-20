import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import QuickCreateMenu from './QuickCreateMenu';
import UserMenu from '@/features/auth/components/UserMenu';
import NotificationBell from '@/features/notifications/components/NotificationBell';

/** Title shown in the top bar for the current page. */
export function pageTitleForPath(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/invoices/')) return 'Invoice';
  if (pathname.startsWith('/invoices')) return 'Invoices';
  if (pathname.startsWith('/importers')) return 'Importers';
  if (pathname.startsWith('/exporter')) return 'Exporter';
  if (pathname.startsWith('/products')) return 'Products';
  if (pathname.startsWith('/documents')) return 'Documents';
  if (pathname.startsWith('/recycle-bin')) return 'Recycle Bin';
  if (pathname.startsWith('/notifications')) return 'Notifications';
  if (pathname.startsWith('/profile')) return 'My Profile';
  return 'Invoice Manager';
}

const todayLabel = () => new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());

interface TopBarProps {
  onOpenMobileSidebar: () => void;
}

export default function TopBar({ onOpenMobileSidebar }: TopBarProps) {
  const { pathname } = useLocation();
  return (
    <header className="h-16 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-40">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="btn-icon shrink-0 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">{pageTitleForPath(pathname)}</p>
          <p className="truncate text-[11px] text-muted-foreground">{todayLabel()}</p>
        </div>
        <QuickCreateMenu />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}

import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, FileEdit, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/importers', icon: Users, label: 'Importers' },
  { to: '/documents', icon: FileEdit, label: 'Documents' },
];

interface SidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ isMobileOpen, onCloseMobile }: SidebarProps) {
  return (
    <>
      {isMobileOpen ? (
        <button
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onCloseMobile}
          aria-label="Close sidebar backdrop"
        />
      ) : null}

      <aside
        className={cn(
          'w-64 border-r bg-card flex flex-col shrink-0',
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:relative md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="h-16 flex items-center px-6 border-b">
          <FileText className="h-6 w-6 text-primary mr-2" />
          <span className="font-bold text-lg">InvoiceManager</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              {...(end !== undefined ? { end } : {})}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t text-xs text-muted-foreground">
          Invoice Management System v1.0
        </div>
      </aside>
    </>
  );
}

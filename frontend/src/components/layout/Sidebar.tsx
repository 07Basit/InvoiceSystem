import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, FileEdit, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/importers', icon: Users, label: 'Importers' },
  { to: '/documents', icon: FileEdit, label: 'Documents' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b">
        <FileText className="h-6 w-6 text-primary mr-2" />
        <span className="font-bold text-lg">InvoiceManager</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            {...(end !== undefined ? { end } : {})}
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

      {/* Footer */}
      <div className="p-4 border-t text-xs text-muted-foreground">
        Invoice Management System v1.0
      </div>
    </aside>
  );
}

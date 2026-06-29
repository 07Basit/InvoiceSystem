import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, FileEdit, Receipt, TrendingUp, Trash2 } from 'lucide-react';
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
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          aria-label="Close sidebar backdrop"
        />
      ) : null}

      <aside
        className={cn(
          'w-64 flex flex-col shrink-0',
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:relative md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          'bg-[hsl(var(--sidebar-bg))]',
        )}
      >
        {/* Logo / Brand */}
        <div className="h-16 flex items-center px-5 border-b border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--brand-accent))] flex items-center justify-center shadow-lg">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm text-white tracking-tight">InvoiceManager</span>
              <p className="text-[10px] text-[hsl(var(--sidebar-fg))] leading-none mt-0.5">Management System</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-0.5">
          <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--sidebar-fg))]/50 px-3 mb-3 font-semibold">
            Navigation
          </p>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              {...(end !== undefined ? { end } : {})}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active-fg))] shadow-md'
                    : 'text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : '')} />
                  <span>{label}</span>
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/80" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-3">
          <NavLink
            to="/recycle-bin"
            onClick={onCloseMobile}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-red-600/20 text-red-300 shadow-md'
                  : 'text-[hsl(var(--sidebar-fg))]/60 hover:bg-red-600/10 hover:text-red-300',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Trash2 className={cn('h-4 w-4 shrink-0', isActive ? 'text-red-300' : '')} />
                <span>Recycle Bin</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-300/80" />
                )}
              </>
            )}
          </NavLink>
        </div>

        <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-2.5 px-1">
            <div className="h-7 w-7 rounded-full bg-[hsl(var(--sidebar-hover-bg))] flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-[hsl(var(--sidebar-fg))]" />
            </div>
            <div>
              <p className="text-xs font-medium text-[hsl(var(--sidebar-fg))]">v1.0.0</p>
              <p className="text-[10px] text-[hsl(var(--sidebar-fg))]/50">Invoice System</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

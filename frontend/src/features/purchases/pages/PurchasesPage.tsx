import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, LineChart, ReceiptText, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/purchases', label: 'Invoices', icon: ReceiptText, end: true },
  { to: '/purchases/reports', label: 'Reports', icon: BarChart3, end: false },
  { to: '/purchases/price-tracker', label: 'Price tracker', icon: LineChart, end: false },
];

/** The Purchases area: Upload invoice, then Invoices, Reports and Price tracker. */
export default function PurchasesPage() {
  const { pathname } = useLocation();
  return (
    <div className="space-y-4">
      <h1 className="sr-only">Purchases</h1>
      <div role="group" aria-label="Purchases menu" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
        <NavLink to="/purchases/upload" className="btn-brand"><Upload className="h-4 w-4" /> Upload invoice</NavLink>
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <nav aria-label="Purchase pages" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn('flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive || (to === '/purchases' && pathname.startsWith('/purchases/list')) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

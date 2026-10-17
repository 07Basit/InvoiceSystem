import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, DollarSign, Info, Maximize2, Receipt, TrendingUp, Users, X } from 'lucide-react';
import type { ApiResponse } from 'shared';
import { apiClient } from '@/services/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import BaseCurrencySelect from '../components/BaseCurrencySelect';
import ConversionInfoDialog from '../components/ConversionInfoDialog';

interface DashboardStats {
  currency: string;
  missingRates: string[];
  excludedInvoices: number;
  overview: {
    totalRevenue: number;
    totalInvoices: number;
    totalImporters: number;
  };
  monthly: Array<{ month: string; revenue: number; invoices: number }>;
  topImporters: Array<{ id: string; name: string; revenue: number; invoiceCount: number }>;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    total: number;
    currency: string;
    excludedFromRevenue: boolean;
    importer: { name: string };
  }>;
  importers: Array<{
    id: string;
    name: string;
    buyerName: string | null;
    currency: string;
    invoiceCount: number;
    revenue: number;
  }>;
}

function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DashboardStats>>('/dashboard/stats');
      return data;
    },
  });
}

const BAR_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(y!, m! - 1, 1));
}

function compact(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  children: (expanded: boolean) => React.ReactNode;
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  return (
    <>
      <div className="card-enterprise p-5 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={`Expand ${title}`}
            title="Expand"
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        <div className="h-60">{children(false)}</div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="bg-background rounded-xl shadow-xl w-full max-w-5xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Close"
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[60vh]">{children(true)}</div>
          </div>
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboardStats();
  const [infoOpen, setInfoOpen] = useState(false);
  const stats = data?.data;

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const currency = stats?.currency ?? 'USD';
  const overview = stats?.overview;
  const monthly = (stats?.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month) }));

  const statCards = [
    { label: 'Total Revenue', value: formatCurrency(overview?.totalRevenue ?? 0, currency), icon: DollarSign, iconBg: 'bg-emerald-100 text-emerald-700' },
    { label: 'Total Invoices', value: overview?.totalInvoices ?? 0, icon: Receipt, iconBg: 'bg-blue-100 text-blue-700' },
    { label: 'Importers', value: overview?.totalImporters ?? 0, icon: Users, iconBg: 'bg-violet-100 text-violet-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Business overview and recent activity</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <BaseCurrencySelect current={currency} />
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-label="How the dashboard is calculated"
            title="How is this calculated?"
            className="p-2 rounded-lg border hover:bg-muted transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--brand-accent))]/10 border border-[hsl(var(--brand-accent))]/20">
            <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--brand-accent))]" />
            <span className="text-xs font-semibold text-[hsl(var(--brand-accent))]">Live</span>
          </div>
        </div>
      </div>

      {stats && stats.missingRates.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="flex-1">
            {stats.excludedInvoices} {stats.excludedInvoices === 1 ? 'invoice' : 'invoices'} in {stats.missingRates.join(', ')} couldn't be converted to {currency} (no exchange rate found for the invoice date) and {stats.excludedInvoices === 1 ? 'is' : 'are'} left out of revenue.
          </p>
          <button type="button" onClick={() => setInfoOpen(true)} className="font-semibold underline shrink-0">Learn more</button>
        </div>
      )}
      {infoOpen && <ConversionInfoDialog baseCurrency={currency} missingRates={stats?.missingRates ?? []} onClose={() => setInfoOpen(false)} />}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {statCards.map(({ label, value, icon: Icon, iconBg }) => (
          <div key={label} className="stat-card flex items-center gap-4 sm:block">
            <div className={`p-2.5 rounded-xl w-fit sm:mb-4 ${iconBg}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Monthly Revenue" subtitle={`Last 12 months, in ${currency} at each invoice date's rate`}>
          {() => (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={48} tickFormatter={compact} />
              <Tooltip formatter={(v: number) => [formatCurrency(v, currency), 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revFill)" />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Monthly Invoices" subtitle="Invoices created per month">
          {() => (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={32} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [v, 'Invoices']} />
              <Bar dataKey="invoices" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Revenue by Importer" subtitle={`Top importers, in ${currency}`}>
          {(expanded) => stats?.topImporters.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.topImporters} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tickFormatter={compact} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={11} width={expanded ? 200 : 100}
                tickFormatter={(v: string) => (!expanded && v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
              <Tooltip formatter={(v: number) => [formatCurrency(v, currency), 'Revenue']} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {stats.topImporters.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center pt-24">No revenue data yet.</p>
          )}
        </ChartCard>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-enterprise">
          <div className="section-header">
            <h3 className="text-sm font-semibold">Invoices</h3>
            <Link to="/invoices" className="text-xs font-medium text-[hsl(var(--brand-accent))] hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {stats?.recentInvoices.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No invoices yet.</p>
            )}
            {stats?.recentInvoices.map((inv) => (
              <Link key={inv.id} to={`/invoices/${inv.id}`} className={`flex items-center justify-between px-5 py-3.5 transition-colors ${inv.excludedFromRevenue ? 'bg-amber-50 hover:bg-amber-100/70' : 'hover:bg-muted/20'}`}>
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {inv.importer.name} · {formatDate(inv.invoiceDate)}
                  </p>
                </div>
                <div className="flex flex-col items-end shrink-0 ml-3">
                  <span className="text-sm font-semibold">{formatCurrency(inv.total, inv.currency)}</span>
                  {inv.excludedFromRevenue && (
                    <span
                      title={`No exchange rate available for ${inv.currency}, so this invoice is not counted in revenue. Open it to enter a rate.`}
                      className="mt-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-1.5"
                    >
                      Not in revenue
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card-enterprise">
          <div className="section-header">
            <h3 className="text-sm font-semibold">Importers</h3>
            <Link to="/importers" className="text-xs font-medium text-[hsl(var(--brand-accent))] hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {stats?.importers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No importers yet.</p>
            )}
            {stats?.importers.map((imp) => (
              <div key={imp.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                    {imp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{imp.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{imp.buyerName ? `${imp.buyerName} · ` : ''}{imp.invoiceCount} {imp.invoiceCount === 1 ? 'invoice' : 'invoices'}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold shrink-0 ml-3">{formatCurrency(imp.revenue, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api';
import type { ApiResponse } from 'shared';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/features/invoices/components/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Receipt, Users, DollarSign, AlertTriangle, TrendingUp, ArrowUpRight } from 'lucide-react';

interface DashboardStats {
  overview: {
    totalInvoices: number;
    totalImporters: number;
    totalRevenue: number;
    paidInvoicesCount: number;
    pendingInvoicesCount: number;
    overdueInvoicesCount: number;
  };
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    total: number;
    createdAt: string;
    importer: { name: string };
  }>;
  topImporters: Array<{ id: string; name: string; totalPaid: number; invoiceCount: number }>;
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

export default function DashboardPage() {
  const { data, isLoading } = useDashboardStats();
  const stats = data?.data;

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const overview = stats?.overview;

  const statCards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(overview?.totalRevenue ?? 0),
      icon: DollarSign,
      iconBg: 'bg-emerald-100 text-emerald-700',
      trend: '+12%',
      trendUp: true,
    },
    {
      label: 'Total Invoices',
      value: overview?.totalInvoices ?? 0,
      icon: Receipt,
      iconBg: 'bg-blue-100 text-blue-700',
      trend: '+5',
      trendUp: true,
    },
    {
      label: 'Total Importers',
      value: overview?.totalImporters ?? 0,
      icon: Users,
      iconBg: 'bg-violet-100 text-violet-700',
      trend: 'Active',
      trendUp: true,
    },
    {
      label: 'Overdue',
      value: overview?.overdueInvoicesCount ?? 0,
      icon: AlertTriangle,
      iconBg: 'bg-red-100 text-red-700',
      trend: 'Needs attention',
      trendUp: false,
    },
  ];

  const paidCount = overview?.paidInvoicesCount ?? 0;
  const pendingCount = overview?.pendingInvoicesCount ?? 0;
  const overdueCount = overview?.overdueInvoicesCount ?? 0;
  const total = paidCount + pendingCount + overdueCount || 1;
  const paidPct = Math.round((paidCount / total) * 100);
  const pendingPct = Math.round((pendingCount / total) * 100);
  const overduePct = Math.round((overdueCount / total) * 100);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Business overview and recent activity</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--brand-accent))]/10 border border-[hsl(var(--brand-accent))]/20">
          <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--brand-accent))]" />
          <span className="text-xs font-semibold text-[hsl(var(--brand-accent))]">Live</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, iconBg, trend, trendUp }) => (
          <div key={label} className="stat-card group">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${iconBg}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full
                ${trendUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {trendUp && <ArrowUpRight className="h-2.5 w-2.5" />}
                {trend}
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Invoice Status Bar */}
      <div className="card-enterprise p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Invoice Status Overview</h3>
          <span className="text-xs text-muted-foreground">{total} total</span>
        </div>
        {/* Progress bar */}
        <div className="h-2.5 rounded-full bg-muted overflow-hidden flex mb-4">
          {paidPct > 0 && <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${paidPct}%` }} />}
          {pendingPct > 0 && <div className="bg-blue-500 transition-all duration-500" style={{ width: `${pendingPct}%` }} />}
          {overduePct > 0 && <div className="bg-red-500 transition-all duration-500" style={{ width: `${overduePct}%` }} />}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Paid', count: paidCount, pct: paidPct, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
            { label: 'Pending', count: pendingCount, pct: pendingPct, color: 'bg-blue-500', textColor: 'text-blue-700' },
            { label: 'Overdue', count: overdueCount, pct: overduePct, color: 'bg-red-500', textColor: 'text-red-700' },
          ].map(({ label, count, pct, color, textColor }) => (
            <div key={label} className="text-center p-3 rounded-lg bg-muted/40">
              <div className={`inline-block h-2 w-2 rounded-full ${color} mb-2`} />
              <p className={`text-xl font-bold ${textColor}`}>{count}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mt-0.5">{label}</p>
              <p className="text-[10px] text-muted-foreground">{pct}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="card-enterprise">
          <div className="section-header">
            <h3 className="text-sm font-semibold">Recent Invoices</h3>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="divide-y">
            {stats?.recentInvoices.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No recent invoices.</p>
            )}
            {stats?.recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {inv.importer.name} · {formatDate(inv.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <StatusBadge status={inv.status} />
                  <span className="text-sm font-semibold">{formatCurrency(inv.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Importers */}
        <div className="card-enterprise">
          <div className="section-header">
            <h3 className="text-sm font-semibold">Top Importers</h3>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="divide-y">
            {stats?.topImporters.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No importer data yet.</p>
            )}
            {stats?.topImporters.map((client, i) => (
              <div key={client.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4 font-semibold">{i + 1}</span>
                  <div className="h-8 w-8 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold">
                    {client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.invoiceCount} invoices</p>
                  </div>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(client.totalPaid)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

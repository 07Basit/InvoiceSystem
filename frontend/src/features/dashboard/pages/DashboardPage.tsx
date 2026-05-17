import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api';
import type { ApiResponse } from 'shared';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/features/invoices/components/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Receipt, Users, DollarSign, AlertTriangle } from 'lucide-react';

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
    { label: 'Total Revenue', value: formatCurrency(overview?.totalRevenue ?? 0), icon: DollarSign, color: 'text-green-600 bg-green-100' },
    { label: 'Total Invoices', value: overview?.totalInvoices ?? 0, icon: Receipt, color: 'text-blue-600 bg-blue-100' },
    { label: 'Total Importers', value: overview?.totalImporters ?? 0, icon: Users, color: 'text-purple-600 bg-purple-100' },
    { label: 'Overdue', value: overview?.overdueInvoicesCount ?? 0, icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of your business</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border rounded-lg p-5 bg-card">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <div className={`p-2 rounded-md ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-3">{value}</p>
          </div>
        ))}
      </div>

      {/* Invoice Status Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-5 bg-card text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{overview?.paidInvoicesCount ?? 0}</p>
        </div>
        <div className="border rounded-lg p-5 bg-card text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{overview?.pendingInvoicesCount ?? 0}</p>
        </div>
        <div className="border rounded-lg p-5 bg-card text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Overdue</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{overview?.overdueInvoicesCount ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="border rounded-lg bg-card">
          <div className="p-5 border-b">
            <h3 className="font-semibold">Recent Invoices</h3>
          </div>
          <div className="divide-y">
            {stats?.recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-mono text-sm font-medium">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">{inv.importer.name} · {formatDate(inv.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={inv.status} />
                  <span className="text-sm font-medium">{formatCurrency(inv.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Importers */}
        <div className="border rounded-lg bg-card">
          <div className="p-5 border-b">
            <h3 className="font-semibold">Top Importers</h3>
          </div>
          <div className="divide-y">
            {stats?.topImporters.map((client, i) => (
              <div key={client.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                    {client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.invoiceCount} invoices</p>
                  </div>
                </div>
                <span className="text-sm font-medium">{formatCurrency(client.totalPaid)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

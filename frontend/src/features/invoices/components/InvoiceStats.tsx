import { AlertTriangle, CalendarDays, FileText, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import type { InvoiceSummary } from '../services/invoiceService';

interface InvoiceStatsProps {
  summary: InvoiceSummary;
}

/** 1.2M style, so a big total still fits a small tile; the full amount is in the tooltip. */
function compactCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2 }).format(amount);
  } catch {
    return formatCurrency(amount, currency);
  }
}

/** Four small headline tiles shown above the invoice list. */
export default function InvoiceStats({ summary }: InvoiceStatsProps) {
  const { total, thisMonth, totalValue, monthValue, baseCurrency, notInRevenue } = summary;

  const tiles = [
    { key: 'total', label: 'Total invoices', value: String(total), icon: FileText, tone: 'bg-violet-100 text-violet-700' },
    { key: 'month', label: 'Invoices this month', value: String(thisMonth), icon: CalendarDays, tone: 'bg-blue-100 text-blue-700' },
    {
      key: 'value', label: `Revenue this month (${baseCurrency})`, value: compactCurrency(monthValue, baseCurrency), icon: Wallet,
      tone: 'bg-emerald-100 text-emerald-700', title: `${formatCurrency(monthValue, baseCurrency)} this month. All time: ${formatCurrency(totalValue, baseCurrency)}`,
    },
    {
      key: 'norate', label: 'Not in revenue', value: String(notInRevenue), icon: AlertTriangle,
      tone: notInRevenue > 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
      title: 'Invoices with no exchange rate yet. Open one to enter a rate.',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Invoice summary">
      {tiles.map(({ key, label, value, icon: Icon, tone, title }) => (
        <div key={key} title={title} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 sm:px-4">
          <div className={cn('hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight truncate" data-testid={`invoice-stat-${key}`}>{value}</p>
            <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

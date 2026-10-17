import type { ReactNode } from 'react';
import { CalendarDays, Download, Eye, FileDown, Package, Pencil, PlaneLanding, PlaneTakeoff, Trash2 } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import Tooltip from '@/components/ui/Tooltip';
import { formatCountry, formatPortCode } from '@/lib/format';
import type { InvoiceListItem } from '../services/invoiceService';

interface InvoiceCardProps {
  invoice: InvoiceListItem;
  onOpen: () => void;
  onPdf: () => void;
  onExcel: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
}

function ActionButton({ label, onClick, children, danger, disabled }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <Tooltip label={label} align="end">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        disabled={disabled}
        aria-label={label}
        className={cn('p-2 rounded-md transition-colors disabled:opacity-50', danger ? 'hover:bg-destructive/10' : 'hover:bg-accent')}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export default function InvoiceCard({ invoice, onOpen, onPdf, onExcel, onEdit, onDelete, deleting }: InvoiceCardProps) {
  const importerName = invoice.importerName ?? invoice.importer.name; // the invoice's own copy
  const { portOfLoading, portOfDischarge, finalDestination, countryOfOrigin, countryOfDestination } = invoice;
  const hasRoute = !!(portOfLoading || portOfDischarge || finalDestination);
  const showFinal = !!finalDestination && finalDestination !== portOfDischarge;

  return (
    <div
      onClick={onOpen}
      className={cn(
        'group cursor-pointer rounded-xl border bg-card p-4 space-y-3 transition-all hover:shadow-md hover:border-[hsl(var(--brand-accent))]/40',
        invoice.excludedFromRevenue && 'bg-amber-50 border-amber-200',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-base font-bold truncate">{invoice.invoiceNumber}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> {formatDate(invoice.invoiceDate)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold leading-tight">{formatCurrency(invoice.total, invoice.currency)}</p>
          <p className="text-[11px] font-medium text-muted-foreground">{invoice.currency}</p>
          {invoice.excludedFromRevenue && (
            <span
              title={`No exchange rate available for ${invoice.currency}, so this invoice is not counted in dashboard revenue. Open it to enter a rate.`}
              className="mt-0.5 inline-block rounded-full border border-amber-200 bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700"
            >
              Not in revenue
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] text-[11px] font-bold shrink-0">
          {importerName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{importerName}</p>
          {invoice.buyerName ? <p className="text-xs text-muted-foreground truncate">Buyer: {invoice.buyerName}</p> : null}
        </div>
      </div>

      {hasRoute && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {portOfLoading && (
            <span title={countryOfOrigin ? `Port of loading · ${formatCountry(countryOfOrigin)}` : 'Port of loading'} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5">
              <PlaneTakeoff className="h-3 w-3 text-muted-foreground" /><span className="font-semibold">{formatPortCode(portOfLoading)}</span>
            </span>
          )}
          {portOfLoading && portOfDischarge && <span className="text-muted-foreground">→</span>}
          {portOfDischarge && (
            <span title={countryOfDestination ? `Port of discharge · ${formatCountry(countryOfDestination)}` : 'Port of discharge'} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5">
              <PlaneLanding className="h-3 w-3 text-muted-foreground" /><span className="font-semibold">{formatPortCode(portOfDischarge)}</span>
            </span>
          )}
          {showFinal && <span className="text-muted-foreground">→</span>}
          {showFinal && (
            <span title="Final destination" className="inline-flex items-center rounded-md border bg-background px-2 py-0.5 font-semibold">{formatPortCode(finalDestination)}</span>
          )}
          {countryOfDestination && <span className="text-muted-foreground">· {formatCountry(countryOfDestination)}</span>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-2.5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          {invoice.totalBoxes} {invoice.totalBoxes === 1 ? 'box' : 'boxes'} · {Number(invoice.totalNetWeight).toLocaleString('en-US', { maximumFractionDigits: 2 })} kg
        </p>
        <div className="flex items-center">
          <ActionButton label="View details" onClick={onOpen}><Eye className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="Download PDF" onClick={onPdf}><FileDown className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="Download Excel" onClick={onExcel}><Download className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="Edit invoice" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="Delete invoice" onClick={onDelete} danger disabled={!!deleting}><Trash2 className="h-3.5 w-3.5 text-destructive" /></ActionButton>
        </div>
      </div>
    </div>
  );
}

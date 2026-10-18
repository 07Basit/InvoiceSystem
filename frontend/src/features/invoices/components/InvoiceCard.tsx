import type { ReactNode } from 'react';
import { CalendarDays, Download, Eye, FileDown, Package, Pencil, PlaneLanding, PlaneTakeoff, Printer, Share2, Trash2, FileCheck2, ArrowLeftRight } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import Tooltip from '@/components/ui/Tooltip';
import { formatCountry, formatPortCode } from '@/lib/format';
import { actualInvoiceState, canHaveActual, counterpartState, type InvoiceListItem } from '../services/invoiceService';

interface InvoiceCardProps {
  invoice: InvoiceListItem;
  onOpen: () => void;
  onPdf: () => void;
  onExcel: () => void;
  onPrint: () => void;
  onShare: () => void;
  onCreateActual: () => void;
  /** Makes the other kind of this invoice (custom from party, party from custom); the button is left out when not given */
  onCreateCounterpart?: () => void;
  creatingCounterpart?: boolean;
  /** Making the actual invoice right now */
  creatingActual?: boolean;
  /** A document action is already running */
  documentsBusy?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
  /** Selection mode: a click on the card selects it (highlighted) instead of opening the invoice. */
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

function ActionButton({ label, onClick, children, danger, disabled, greyed }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean; disabled?: boolean; greyed?: boolean }) {
  return (
    <Tooltip label={label} align="end">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        disabled={disabled}
        aria-label={label}
        className={cn('p-2 rounded-md transition-colors disabled:opacity-50', danger ? 'hover:bg-destructive/10' : 'hover:bg-accent', greyed && 'cursor-not-allowed text-muted-foreground opacity-40 grayscale hover:bg-transparent')}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export default function InvoiceCard({ invoice, onOpen, onPdf, onExcel, onPrint, onShare, onCreateActual, creatingActual, onCreateCounterpart, creatingCounterpart, documentsBusy, onEdit, onDelete, deleting, selectionMode, selected, onToggleSelect }: InvoiceCardProps) {
  const importerName = invoice.importerName ?? invoice.importer.name; // the invoice's own copy
  const { portOfLoading, portOfDischarge, finalDestination, countryOfOrigin, countryOfDestination } = invoice;
  const hasRoute = !!(portOfLoading || portOfDischarge || finalDestination);
  const actual = actualInvoiceState(invoice);
  const counterpart = counterpartState(invoice);
  const showFinal = !!finalDestination && finalDestination !== portOfDischarge;

  return (
    <div
      onClick={selectionMode ? onToggleSelect : onOpen}
      {...(selectionMode ? { role: 'button', 'aria-pressed': !!selected, 'aria-label': `${selected ? 'Unselect' : 'Select'} invoice ${invoice.invoiceNumber}`, tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggleSelect?.(); } } } : {})}
      className={cn(
        'group cursor-pointer rounded-xl border bg-card card-pattern p-4 flex flex-col gap-3 transition-all hover:shadow-md hover:border-[hsl(var(--brand-accent))]/40',
        invoice.excludedFromRevenue && 'bg-none bg-amber-50 border-amber-200',
        selected && 'border-[hsl(var(--brand-accent))] ring-2 ring-[hsl(var(--brand-accent))]/40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-base font-bold">
            <span className="truncate">{invoice.invoiceNumber}</span>
            {(invoice.invoiceKind === 'PARTY' || invoice.invoiceKind === 'CUSTOM') && (
              <span className={cn('shrink-0 rounded-full border px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide', invoice.invoiceKind === 'CUSTOM' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'bg-muted text-muted-foreground')}>
                {invoice.invoiceKind === 'CUSTOM' ? 'Custom' : 'Party'}
              </span>
            )}
          </p>
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

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2.5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          {invoice.totalBoxes} {invoice.totalBoxes === 1 ? 'box' : 'boxes'} · {Number(invoice.totalNetWeight).toLocaleString('en-US', { maximumFractionDigits: 2 })} kg
        </p>
        <div className="flex items-center">
          <ActionButton label="View details" onClick={onOpen}><Eye className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="Print invoice" onClick={onPrint} disabled={!!documentsBusy}><Printer className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="Download PDF" onClick={onPdf} disabled={!!documentsBusy}><FileDown className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="Download Excel" onClick={onExcel} disabled={!!documentsBusy}><Download className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="Share invoice" onClick={onShare}><Share2 className="h-3.5 w-3.5" /></ActionButton>
          {canHaveActual(invoice) && (
            <ActionButton label={actual.label} onClick={onCreateActual} disabled={!actual.canCreate || !!creatingActual} greyed={!actual.canCreate}><FileCheck2 className="h-3.5 w-3.5" /></ActionButton>
          )}
          {onCreateCounterpart && counterpart.available && (
            <ActionButton label={counterpart.label} onClick={onCreateCounterpart} disabled={!counterpart.canCreate || !!creatingCounterpart} greyed={!counterpart.canCreate}><ArrowLeftRight className="h-3.5 w-3.5" /></ActionButton>
          )}
          <ActionButton label="Edit invoice" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="Delete invoice" onClick={onDelete} danger disabled={!!deleting}><Trash2 className="h-3.5 w-3.5 text-destructive" /></ActionButton>
        </div>
      </div>
    </div>
  );
}

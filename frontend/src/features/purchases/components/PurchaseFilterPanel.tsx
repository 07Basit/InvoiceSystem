import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';
import { Section } from '@/features/invoices/components/InvoiceFilterPanel';
import { cn } from '@/lib/utils';
import type { Supplier } from '../services/purchaseService';
import { PERIODS } from '../utils/periods';
import { countActive, noPurchaseFilters, type DateBasis, type PurchaseFilterValues } from '../utils/purchaseFilters';

interface PurchaseFilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: PurchaseFilterValues;
  onChange: (filters: PurchaseFilterValues) => void;
  suppliers: Supplier[];
  /** Which sections to offer */
  show: { basis?: boolean; supplier?: boolean; product?: boolean };
  /** How many invoices the current filters match (shown on the bottom button) */
  matching: number | undefined;
  /** What is counted on the bottom button (default "invoice") */
  noun?: string;
}

const chip = (active: boolean) => cn('rounded-full border px-3 py-1.5 text-xs transition-colors', active ? 'border-[hsl(var(--brand-accent))]/60 bg-[hsl(var(--brand-accent))]/10 font-semibold text-[hsl(var(--brand-accent))]' : 'bg-background hover:bg-accent');

const BASES: { id: DateBasis; label: string }[] = [
  { id: 'invoice', label: 'Invoice date' },
  { id: 'purchase', label: 'Purchase date' },
];

/** The purchase filters in one panel, like the invoice filters: a side panel on computers, a bottom sheet on phones. */
export default function PurchaseFilterPanel({ open, onClose, filters, onChange, suppliers, show, matching, noun = 'invoice' }: PurchaseFilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof PurchaseFilterValues>(key: K, value: PurchaseFilterValues[K]) => onChange({ ...filters, [key]: value });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const periods = PERIODS.filter((p) => p.id !== 'all');
  const activePeriod = periods.find((p) => { const r = p.range(new Date()); return r.from === filters.dateFrom && r.to === filters.dateTo; })?.id;
  const active = countActive(filters);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-stretch sm:justify-end" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Filter purchases" tabIndex={-1} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-background shadow-2xl outline-none sm:max-h-none sm:w-[400px] sm:rounded-none sm:rounded-l-2xl">
        <div className="flex items-center justify-between gap-3 border-b bg-gradient-to-r from-[hsl(var(--primary)/0.08)] to-[hsl(var(--brand-accent)/0.14)] px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold"><SlidersHorizontal className="h-4 w-4" /> Filters {active > 0 && <span className="rounded-full bg-[hsl(var(--brand-accent))] px-2 text-xs font-semibold text-white">{active}</span>}</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onChange(noPurchaseFilters)} disabled={active === 0} className="rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40">Clear all</button>
            <button type="button" onClick={onClose} aria-label="Close filters" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-2">
          <Section title="Date" defaultOpen count={filters.dateFrom || filters.dateTo ? 1 : 0}>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick dates">
              {periods.map((p) => (
                <button key={p.id} type="button" aria-pressed={activePeriod === p.id} onClick={() => onChange({ ...filters, ...(activePeriod === p.id ? { dateFrom: '', dateTo: '' } : { dateFrom: p.range(new Date()).from, dateTo: p.range(new Date()).to }) })} className={chip(activePeriod === p.id)}>{p.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">From</label><DatePicker ariaLabel="Date from" value={filters.dateFrom} onChange={(v) => set('dateFrom', v)} placeholder="Any" /></div>
              <div><label className="label">To</label><DatePicker ariaLabel="Date to" value={filters.dateTo} onChange={(v) => set('dateTo', v)} placeholder="Any" /></div>
            </div>
            {show.basis && (
              <div role="radiogroup" aria-label="Date to filter by" className="flex flex-wrap gap-1.5">
                {BASES.map(({ id, label }) => <button key={id} type="button" role="radio" aria-checked={filters.basis === id} onClick={() => set('basis', id)} className={chip(filters.basis === id)}>{label}</button>)}
              </div>
            )}
          </Section>

          {show.supplier && (
            <Section title="Supplier" defaultOpen count={filters.supplierId ? 1 : 0}>
              <div role="radiogroup" aria-label="Supplier" className="flex flex-wrap gap-1.5">
                <button type="button" role="radio" aria-checked={!filters.supplierId} onClick={() => set('supplierId', '')} className={chip(!filters.supplierId)}>All suppliers</button>
                {suppliers.filter((s) => s.isActive || s.id === filters.supplierId).map((s) => <button key={s.id} type="button" role="radio" aria-checked={filters.supplierId === s.id} onClick={() => set('supplierId', s.id)} className={chip(filters.supplierId === s.id)}>{s.name}</button>)}
              </div>
            </Section>
          )}

          {show.product && (
            <Section title="Product" defaultOpen count={filters.product.trim() ? 1 : 0}>
              <input aria-label="Product" value={filters.product} onChange={(e) => set('product', e.target.value)} className="input" placeholder="Product, e.g. Amla" />
            </Section>
          )}
        </div>

        <div className="border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="w-full rounded-lg bg-[hsl(var(--brand-accent))] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90">
            {matching === undefined ? `Show ${noun}s` : `Show ${matching} ${noun}${matching === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

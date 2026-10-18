import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';
import NumberInput from '@/components/ui/NumberInput';
import { formatCountry } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InvoiceFilterOptions } from '../services/invoiceService';
import { MONTH_NAMES, QUICK_DATES, activeQuickDate, countActive, isEmptyFilters, noFilters, quickRange, type InvoiceFilterValues, type InvoiceKindFilter, type InvoiceType } from '../utils/invoiceFilters';
import FilterChipGroup, { type ChipOption } from './FilterChipGroup';

interface InvoiceFilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: InvoiceFilterValues;
  onChange: (filters: InvoiceFilterValues) => void;
  options: InvoiceFilterOptions | undefined;
  importers: Array<{ id: string; name: string; isActive?: boolean }>;
  /** How many invoices the current filters match (shown on the bottom button) */
  matching: number | undefined;
}

function Section({ title, count, defaultOpen, children }: { title: string; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen || (count ?? 0) > 0);
  return (
    <section className="border-t py-3 first:border-t-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {title}
          {count ? <span className="rounded-full bg-[hsl(var(--brand-accent))]/15 px-1.5 text-[11px] font-semibold text-[hsl(var(--brand-accent))]">{count}</span> : null}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}

const TYPES: { id: InvoiceType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'regular', label: 'Regular only' },
  { id: 'actual', label: 'Actual only' },
];

const KINDS: { id: InvoiceKindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'normal', label: 'Normal' },
  { id: 'party', label: 'Party' },
  { id: 'custom', label: 'Custom' },
];

const asOptions = (values: string[] | undefined, label: (v: string) => string = (v) => v): ChipOption[] => (values ?? []).map((value) => ({ value, label: label(value) }));

/**
 * Every invoice filter in one panel: a side panel on tablets and computers, a bottom sheet on phones.
 * Changes apply to the list straight away, so the button at the bottom just closes the panel and shows the count.
 */
export default function InvoiceFilterPanel({ open, onClose, filters, onChange, options, importers, matching }: InvoiceFilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof InvoiceFilterValues>(key: K, value: InvoiceFilterValues[K]) => onChange({ ...filters, [key]: value });

  // The panel is focused once when it opens (not on every change, which would pull the cursor out of a box being typed in)
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

  const quick = activeQuickDate(filters, new Date());
  const amountField = (key: 'minTotal' | 'maxTotal', label: string) => (
    <div>
      <label className="label">{label}</label>
      <NumberInput ariaLabel={`${label} invoice total`} value={Number(filters[key]) || undefined} onChange={(v) => set(key, v === undefined ? '' : String(v))} decimals={2} placeholder="Any" className="input" />
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-stretch sm:justify-end" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filter invoices"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-background shadow-2xl outline-none sm:max-h-none sm:w-[400px] sm:rounded-none sm:rounded-l-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b bg-gradient-to-r from-[hsl(var(--primary)/0.08)] to-[hsl(var(--brand-accent)/0.14)] px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold"><SlidersHorizontal className="h-4 w-4" /> Filters {countActive(filters) > 0 && <span className="rounded-full bg-[hsl(var(--brand-accent))] px-2 text-xs font-semibold text-white">{countActive(filters)}</span>}</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onChange(noFilters)} disabled={isEmptyFilters(filters)} className="rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40">Clear all</button>
            <button type="button" onClick={onClose} aria-label="Close filters" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          <Section title="Date" defaultOpen count={filters.dateFrom || filters.dateTo ? 1 : 0}>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick dates">
              {QUICK_DATES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={quick === id}
                  onClick={() => onChange({ ...filters, ...(quick === id ? { dateFrom: '', dateTo: '' } : quickRange(id, new Date())) })}
                  className={cn('rounded-full border px-3 py-1.5 text-xs transition-colors', quick === id ? 'border-[hsl(var(--brand-accent))]/60 bg-[hsl(var(--brand-accent))]/10 font-semibold text-[hsl(var(--brand-accent))]' : 'bg-background hover:bg-accent')}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">From</label><DatePicker ariaLabel="Invoice date from" value={filters.dateFrom} onChange={(v) => set('dateFrom', v)} placeholder="Any" /></div>
              <div><label className="label">To</label><DatePicker ariaLabel="Invoice date to" value={filters.dateTo} onChange={(v) => set('dateTo', v)} placeholder="Any" /></div>
            </div>
          </Section>

          <Section title="Importer" defaultOpen count={filters.importerIds.length}>
            <FilterChipGroup
              ariaLabel="Importers"
              searchable
              searchPlaceholder="Search importers"
              selected={filters.importerIds}
              onChange={(v) => set('importerIds', v)}
              options={importers.map((i): ChipOption => ({ value: i.id, label: i.name, ...(i.isActive === false ? { hint: 'not needed' } : {}) }))}
              emptyText="No importers yet."
            />
          </Section>

          <Section title="Currency" defaultOpen count={filters.currencies.length}>
            <FilterChipGroup ariaLabel="Currencies" selected={filters.currencies} onChange={(v) => set('currencies', v)} options={asOptions(options?.currencies)} emptyText="No invoices yet." />
          </Section>

          <Section title="Year" count={filters.years.length}>
            <FilterChipGroup ariaLabel="Years" selected={filters.years} onChange={(v) => set('years', v)} options={asOptions(options?.years.map(String))} emptyText="No invoices yet." />
          </Section>

          <Section title="Month" count={filters.months.length}>
            <FilterChipGroup ariaLabel="Months" selected={filters.months} onChange={(v) => set('months', v)} options={MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name.slice(0, 3) }))} initialVisible={12} />
            <p className="text-xs text-muted-foreground">Months match in every year, unless you also choose a year.</p>
          </Section>

          <Section title="Amount" count={filters.minTotal.trim() || filters.maxTotal.trim() ? 1 : 0}>
            <div className="grid grid-cols-2 gap-3">{amountField('minTotal', 'Min')}{amountField('maxTotal', 'Max')}</div>
            <p className="text-xs text-muted-foreground">The invoice total, in the invoice's own currency.</p>
          </Section>

          <Section title="Route" count={filters.loadingPorts.length + filters.dischargePorts.length + filters.countries.length}>
            <div><p className="label">From (port of loading)</p><FilterChipGroup ariaLabel="Ports of loading" searchable searchPlaceholder="Search ports" selected={filters.loadingPorts} onChange={(v) => set('loadingPorts', v)} options={asOptions(options?.loadingPorts)} emptyText="No ports saved on invoices yet." /></div>
            <div><p className="label">To (discharge or final destination)</p><FilterChipGroup ariaLabel="Destination ports" searchable searchPlaceholder="Search ports" selected={filters.dischargePorts} onChange={(v) => set('dischargePorts', v)} options={asOptions(options?.dischargePorts)} emptyText="No ports saved on invoices yet." /></div>
            <div><p className="label">Country of destination</p><FilterChipGroup ariaLabel="Countries" searchable searchPlaceholder="Search countries" selected={filters.countries} onChange={(v) => set('countries', v)} options={asOptions(options?.countries, formatCountry)} emptyText="No countries saved on invoices yet." /></div>
          </Section>

          <Section title="Product" count={filters.products.length}>
            <FilterChipGroup ariaLabel="Products" searchable searchPlaceholder="Search products on invoices" selected={filters.products} onChange={(v) => set('products', v)} options={asOptions(options?.products)} emptyText="No products on invoices yet." />
          </Section>

          <Section title="Exporter" count={filters.exporters.length}>
            <FilterChipGroup ariaLabel="Exporters" selected={filters.exporters} onChange={(v) => set('exporters', v)} options={asOptions(options?.exporters)} emptyText="No exporters on invoices yet." />
          </Section>

          <Section title="Normal / Party / Custom" count={filters.kind !== 'all' ? 1 : 0}>
            <div role="radiogroup" aria-label="Normal, party or custom" className="flex flex-wrap gap-1.5">
              {KINDS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={filters.kind === id}
                  onClick={() => set('kind', id)}
                  className={cn('rounded-full border px-3 py-1.5 text-xs transition-colors', filters.kind === id ? 'border-[hsl(var(--brand-accent))]/60 bg-[hsl(var(--brand-accent))]/10 font-semibold text-[hsl(var(--brand-accent))]' : 'bg-background hover:bg-accent')}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Invoice type" count={filters.type !== 'all' ? 1 : 0}>
            <div role="radiogroup" aria-label="Invoice type" className="flex flex-wrap gap-1.5">
              {TYPES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={filters.type === id}
                  onClick={() => set('type', id)}
                  className={cn('rounded-full border px-3 py-1.5 text-xs transition-colors', filters.type === id ? 'border-[hsl(var(--brand-accent))]/60 bg-[hsl(var(--brand-accent))]/10 font-semibold text-[hsl(var(--brand-accent))]' : 'bg-background hover:bg-accent')}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>
        </div>

        <div className="border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="w-full rounded-lg bg-[hsl(var(--brand-accent))] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90">
            {matching === undefined ? 'Show invoices' : `Show ${matching} invoice${matching === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

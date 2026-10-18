import { X } from 'lucide-react';
import { filterChips, removeChip, type InvoiceFilterValues } from '../utils/invoiceFilters';
import { formatCountry } from '@/lib/format';

interface ActiveFilterChipsProps {
  filters: InvoiceFilterValues;
  onChange: (filters: InvoiceFilterValues) => void;
  importerName: (id: string) => string;
}

/** What the list is filtered by, one removable chip per choice. Scrolls sideways on a phone instead of taking up rows. */
export default function ActiveFilterChips({ filters, onChange, importerName }: ActiveFilterChipsProps) {
  const chips = filterChips(filters, importerName, formatCountry);
  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible" role="list" aria-label="Active filters">
      {chips.map((chip) => (
        <span key={`${chip.key}:${chip.value ?? ''}`} role="listitem" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[hsl(var(--brand-accent))]/50 bg-[hsl(var(--brand-accent))]/10 py-1 pl-3 pr-1.5 text-xs font-medium text-[hsl(var(--brand-accent))]">
          {chip.label}
          <button type="button" onClick={() => onChange(removeChip(filters, chip))} aria-label={`Remove filter ${chip.label}`} className="rounded-full p-0.5 hover:bg-[hsl(var(--brand-accent))]/20"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <button type="button" onClick={() => onChange({ ...filters, ...Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, Array.isArray(v) ? [] : k === 'type' ? 'all' : ''])) })} className="ml-1 shrink-0 rounded-full border border-dashed px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">Clear all</button>
    </div>
  );
}

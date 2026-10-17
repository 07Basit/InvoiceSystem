import { Search, X } from 'lucide-react';
import SearchCombobox, { type ComboOption } from '@/components/ui/SearchCombobox';
import { cn } from '@/lib/utils';
import type { InvoiceFilterValues } from '../store/invoiceStore';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface InvoiceFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: InvoiceFilterValues;
  onFilterChange: (key: keyof InvoiceFilterValues, value: string) => void;
  onClear: () => void;
  years: number[];
  currencies: string[];
  importers: Array<{ id: string; name: string; isActive?: boolean }>;
}

interface FilterPickProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  searchPlaceholder: string;
  className?: string;
}

/** One compact dropdown; the first option ("All …") clears it, and it turns orange while a value is set. */
function FilterPick({ label, value, onChange, options, searchPlaceholder, className }: FilterPickProps) {
  return (
    <SearchCombobox
      ariaLabel={label}
      value={value}
      onChange={onChange}
      options={options}
      searchPlaceholder={searchPlaceholder}
      labelClassName="w-auto"
      align="left"
      className={cn(
        'w-full rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
        value !== '' && 'border-[hsl(var(--brand-accent))]/50 bg-[hsl(var(--brand-accent))]/5 font-medium',
        className,
      )}
    />
  );
}

/** Search box plus Year / Month / Importer / Currency filters for the invoice list. */
export default function InvoiceFilters({
  search, onSearchChange, filters, onFilterChange, onClear, years, currencies, importers,
}: InvoiceFiltersProps) {
  const yearOptions: ComboOption[] = [{ value: '', label: 'All years' }, ...years.map((y) => ({ value: String(y), label: String(y) }))];
  const monthOptions: ComboOption[] = [{ value: '', label: 'All months' }, ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))];
  const importerOptions: ComboOption[] = [
    { value: '', label: 'All importers' },
    ...importers.map((i): ComboOption => (i.isActive === false ? { value: i.id, label: i.name, description: 'not needed' } : { value: i.id, label: i.name })),
  ];
  const currencyOptions: ComboOption[] = [{ value: '', label: 'All currencies' }, ...currencies.map((c) => ({ value: c, label: c }))];

  const anyActive = search.trim() !== '' || Object.values(filters).some((v) => v !== '');

  const pick = 'w-[calc(50%-0.25rem)] sm:w-[calc(25%-0.375rem)] lg:w-40 xl:w-44';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search invoices…"
          aria-label="Search invoices"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <div className={pick}><FilterPick label="Year" value={filters.year} onChange={(v) => onFilterChange('year', v)} options={yearOptions} searchPlaceholder="Search year" /></div>
      <div className={pick}><FilterPick label="Month" value={filters.month} onChange={(v) => onFilterChange('month', v)} options={monthOptions} searchPlaceholder="Search month" /></div>
      <div className={pick}><FilterPick label="Importer" value={filters.importerId} onChange={(v) => onFilterChange('importerId', v)} options={importerOptions} searchPlaceholder="Search importer" /></div>
      <div className={pick}><FilterPick label="Currency" value={filters.currency} onChange={(v) => onFilterChange('currency', v)} options={currencyOptions} searchPlaceholder="Search currency, e.g. AED" /></div>

      {anyActive && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}

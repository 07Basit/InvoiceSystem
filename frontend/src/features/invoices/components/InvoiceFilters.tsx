import SearchCombobox, { type ComboOption } from '@/components/ui/SearchCombobox';
import FilterBar from '@/components/ui/FilterBar';
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
  align?: 'left' | 'right';
  className?: string;
}

/** One compact dropdown; the first option ("All …") clears it, and it turns orange while a value is set. */
function FilterPick({ label, value, onChange, options, searchPlaceholder, align = 'left', className }: FilterPickProps) {
  return (
    <SearchCombobox
      ariaLabel={label}
      value={value}
      onChange={onChange}
      options={options}
      searchPlaceholder={searchPlaceholder}
      labelClassName="w-auto"
      align={align}
      className={cn(
        'w-full rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
        value !== '' && 'border-[hsl(var(--brand-accent))]/50 bg-[hsl(var(--brand-accent))]/5 font-medium',
        className,
      )}
    />
  );
}

/** Search box and a Filters button; Year / Month / Importer / Currency live inside the panel. */
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

  const activeCount = Object.values(filters).filter((v) => v !== '').length;

  return (
    <FilterBar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search invoices…"
      searchLabel="Search invoices"
      activeCount={activeCount}
      onClear={onClear}
    >
      <div className="grid w-[min(21rem,calc(100vw-4rem))] grid-cols-1 gap-2 sm:grid-cols-2">
        <FilterPick label="Year" value={filters.year} onChange={(v) => onFilterChange('year', v)} options={yearOptions} searchPlaceholder="Search year" />
        <FilterPick label="Month" value={filters.month} onChange={(v) => onFilterChange('month', v)} options={monthOptions} searchPlaceholder="Search month" align="right" />
        <FilterPick label="Importer" value={filters.importerId} onChange={(v) => onFilterChange('importerId', v)} options={importerOptions} searchPlaceholder="Search importer" />
        <FilterPick label="Currency" value={filters.currency} onChange={(v) => onFilterChange('currency', v)} options={currencyOptions} searchPlaceholder="Search currency, e.g. AED" align="right" />
      </div>
    </FilterBar>
  );
}

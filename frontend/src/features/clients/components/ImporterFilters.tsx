import FilterBar from '@/components/ui/FilterBar';
import { cn } from '@/lib/utils';
import type { StatusFilter } from '../utils/filterImporters';

interface ImporterFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  counts: { all: number; active: number; inactive: number };
}

const options: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/** Search box and a Filters button; the All / Active / Inactive switch lives inside the panel, right-aligned. */
export default function ImporterFilters({ query, onQueryChange, status, onStatusChange, counts }: ImporterFiltersProps) {
  return (
    <FilterBar
      search={query}
      onSearchChange={onQueryChange}
      searchPlaceholder="Search by name, buyer, contact, currency, port or country"
      searchLabel="Search importers"
      activeCount={status === 'all' ? 0 : 1}
      onClear={() => { onQueryChange(''); onStatusChange('all'); }}
    >
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <div role="group" aria-label="Filter by status" className="inline-flex w-fit rounded-lg border bg-muted/40 p-0.5">
          {options.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => onStatusChange(value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                status === value ? 'bg-[hsl(var(--brand-accent))] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label} <span className={cn('ml-0.5 text-xs', status === value ? 'text-white/80' : 'text-muted-foreground')}>{counts[value]}</span>
            </button>
          ))}
        </div>
      </div>
    </FilterBar>
  );
}

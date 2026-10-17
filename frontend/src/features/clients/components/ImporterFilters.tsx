import { Search, X } from 'lucide-react';
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

/** Search box plus an All / Active / Inactive switch, shown above the importer cards. */
export default function ImporterFilters({ query, onQueryChange, status, onStatusChange, counts }: ImporterFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by name, buyer, contact, currency, port or country"
          aria-label="Search importers"
          className="w-full rounded-lg border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div role="group" aria-label="Filter by status" className="inline-flex shrink-0 rounded-lg border bg-muted/40 p-0.5">
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
  );
}

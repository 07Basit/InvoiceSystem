import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChipOption {
  value: string;
  label: string;
  /** Small muted note after the label (e.g. "not needed") */
  hint?: string;
}

interface FilterChipGroupProps {
  options: ChipOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  ariaLabel: string;
  /** Show a search box (for long lists such as importers and products) */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** How many chips to show before "+ N more" */
  initialVisible?: number;
  emptyText?: string;
}

/** Tick any number of values: each one is a chip that lights up when chosen. Long lists get a search box and "+ N more". */
export default function FilterChipGroup({ options, selected, onChange, ariaLabel, searchable, searchPlaceholder = 'Search…', initialVisible = 8, emptyText = 'Nothing to choose from yet.' }: FilterChipGroupProps) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    // chosen values stay in view even when the list is collapsed
    const chosen = matching.filter((o) => selected.includes(o.value));
    const rest = matching.filter((o) => !selected.includes(o.value));
    const limit = expanded || q ? Infinity : Math.max(0, initialVisible - chosen.length);
    return { items: [...chosen, ...rest.slice(0, limit)], hidden: Math.max(0, rest.length - limit), total: matching.length };
  }, [options, selected, query, expanded, initialVisible]);

  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  if (options.length === 0) return <p className="text-xs text-muted-foreground">{emptyText}</p>;

  return (
    <div className="space-y-2">
      {searchable && options.length > initialVisible && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input aria-label={`Search ${ariaLabel}`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} className="w-full rounded-lg border bg-background py-1.5 pl-8 pr-2 text-sm" />
        </div>
      )}
      <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
        {shown.items.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(option.value)}
              className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
                on ? 'border-[hsl(var(--brand-accent))]/60 bg-[hsl(var(--brand-accent))]/10 font-semibold text-[hsl(var(--brand-accent))]' : 'bg-background hover:bg-accent',
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.hint ? <span className="text-[10px] font-normal text-muted-foreground">{option.hint}</span> : null}
            </button>
          );
        })}
        {shown.total === 0 && <p className="text-xs text-muted-foreground">No match for “{query}”.</p>}
        {!query && shown.hidden > 0 && (
          <button type="button" onClick={() => setExpanded(true)} className="rounded-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">+ {shown.hidden} more</button>
        )}
        {!query && expanded && options.length > initialVisible && (
          <button type="button" onClick={() => setExpanded(false)} className="rounded-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">Show fewer</button>
        )}
      </div>
    </div>
  );
}

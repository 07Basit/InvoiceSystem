import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  /** Search box text and handler (the search stays visible; everything else lives in the Filters panel). */
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
  /** How many filters are currently set; shown as a badge on the Filters button. */
  activeCount: number;
  onClear: () => void;
  children: ReactNode;
}

/**
 * One search box plus a single "Filters" button. The filter controls live in a compact panel that drops down
 * under the button, as wide as its contents and anchored to the button's right edge, so it looks the same on a
 * phone, a laptop and a wide monitor (no full-width bar with empty space).
 */
export default function FilterBar({ search, onSearchChange, searchPlaceholder, searchLabel, activeCount, onClear, children }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const anything = activeCount > 0 || search.trim() !== '';

  // A 1px marker just above the bar: once it scrolls out of view, the bar is pinned, so give it a shadow.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry!.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // close on a click outside, or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="!m-0 h-px" />
      <div
        className={cn(
          // pinned to the top of the page area; the negative margins let the background reach the page edges
          // the page's space-y-6 sets its own margins on every child, so these use ! to pull the bar closer to the cards on both sides
          'sticky -top-4 z-20 -mx-4 !mb-[-0.75rem] !mt-3 flex items-center gap-2 bg-background px-4 py-1 transition-shadow sm:-top-6 sm:-mx-6 sm:px-6',
          stuck && 'shadow-[0_6px_10px_-8px_rgba(0,0,0,0.25)]',
        )}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-9 text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div ref={wrapRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="filter-panel"
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
              (open || activeCount > 0) && 'border-[hsl(var(--brand-accent))]/50 bg-[hsl(var(--brand-accent))]/5',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filters</span>
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--brand-accent))] px-1 text-[11px] font-semibold text-white" aria-label={`${activeCount} active`}>
                {activeCount}
              </span>
            )}
          </button>

          {open && (
            <div
              id="filter-panel"
              className="absolute right-0 top-full z-40 mt-2 w-max max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border bg-card p-3 shadow-lg"
            >
              {children}
              {anything && (
                <div className="flex justify-end">
                  <button type="button" onClick={onClear} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" /> Clear search and filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

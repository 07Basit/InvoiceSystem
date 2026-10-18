import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFloatingPosition } from '@/lib/useFloatingPosition';

export interface ComboOption {
  /** What gets stored/returned when picked (e.g. "INR", "BOM", "India"). */
  value: string;
  /** Main text of the row (usually the code or the name). */
  label: string;
  /** Muted secondary text (e.g. "Indian Rupee", "Mumbai · Chhatrapati Shivaji Maharaj Intl"). */
  description?: string;
  /** Extra words that should match a search but aren't shown. */
  keywords?: string;
}

interface SearchComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  /** Listed first (under a "Common" heading) while the search box is empty. */
  common?: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  hasError?: boolean;
  /** Classes for the closed trigger button. */
  className?: string;
  /** What the trigger shows for the current value; defaults to "Label — Description". */
  display?: string;
  /** Icon/text shown before the value on the trigger. */
  leading?: ReactNode;
  align?: 'left' | 'right';
  /** Width class for the label column in rows (e.g. "w-10" for 3-letter codes). */
  labelClassName?: string;
  /** Shown instead of the list while the options are still loading. */
  loading?: boolean;
  /** Most rows rendered at once; keeps very long lists (airports) fast. */
  maxResults?: number;
  /** Lets the person use text that is not in the list: a "Use “…”" row appears while they type. */
  allowCustom?: boolean;
  /** With allowCustom: also offer "Add “…” to the list"; called with the typed text, which then becomes the value. */
  onCreate?: (text: string) => void;
  /** Wording for the add row, e.g. "products" gives "Add “mango” to products". */
  createTarget?: string;
}

const USE = '\u0000use:';
const ADD = '\u0000add:';

/** Lower is better; Infinity means no match. */
function rank(option: ComboOption, q: string): number {
  const value = option.value.toLowerCase();
  const label = option.label.toLowerCase();
  const text = `${option.description ?? ''} ${option.keywords ?? ''}`.toLowerCase();
  if (value === q || label === q) return 0;
  if (value.startsWith(q) || label.startsWith(q)) return 1;
  if (text.startsWith(q)) return 2;
  if (`${label} ${text}`.split(/[\s(),/·-]+/).some((w) => w.startsWith(q))) return 3;
  if (label.includes(q) || text.includes(q)) return 4;
  return Infinity;
}

/** Themed, searchable picker: type "inr" and INR is offered. Used for currencies, airports and countries. */
export default function SearchCombobox({
  value, onChange, options, common = [], placeholder = 'Select', searchPlaceholder = 'Search…', ariaLabel,
  disabled, hasError, className, display, leading, align = 'left', labelClassName = 'w-10', loading = false, maxResults = 200,
  allowCustom = false, onCreate, createTarget = 'the list',
}: SearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const position = useFloatingPosition(open, rootRef, { width: 320, height: 340, alignRight: align === 'right' });

  const selected = options.find((o) => o.value === value);
  const shown = display ?? (selected ? (selected.description ? `${selected.label} — ${selected.description}` : selected.label) : value);

  // Flat, ordered list of what is currently visible (headings are drawn separately).
  const { items, commonCount, total } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const ranked = options
        .map((o) => ({ o, r: rank(o, q) }))
        .filter((x) => x.r !== Infinity)
        .sort((a, b) => a.r - b.r || a.o.label.localeCompare(b.o.label))
        .map((x) => x.o);
      const typed = query.trim();
      const exact = options.some((o) => o.label.toLowerCase() === q || o.value.toLowerCase() === q);
      const custom: ComboOption[] = allowCustom && !exact
        ? [{ value: `${USE}${typed}`, label: `Use “${typed}”`, description: 'as typed' }, ...(onCreate ? [{ value: `${ADD}${typed}`, label: `Add “${typed}”`, description: `to ${createTarget}` }] : [])]
        : [];
      return { items: [...ranked.slice(0, maxResults), ...custom], commonCount: 0, total: ranked.length + custom.length };
    }
    const commonValues = new Set(common.map((c) => c.value));
    const all = [...common, ...options.filter((o) => !commonValues.has(o.value))];
    return { items: all.slice(0, maxResults), commonCount: common.length, total: all.length };
  }, [query, options, common, maxResults, allowCustom, onCreate, createTarget]);

  const close = () => { setOpen(false); setQuery(''); };

  const openList = (seed = '') => {
    if (disabled) return;
    setQuery(seed);
    setActive(0);
    setOpen(true);
  };

  const choose = (next: string) => {
    if (next.startsWith(USE)) onChange(next.slice(USE.length));
    else if (next.startsWith(ADD)) { const text = next.slice(ADD.length); onCreate?.(text); onChange(text); }
    else onChange(next);
    close();
  };

  useEffect(() => {
    if (!open) return;
    // straight into the search box, caret after anything already typed (so "c" then "a" reads "ca")
    const input = searchRef.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted row visible while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open, items]);

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const item = items[active]; if (item) choose(item.value); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); (rootRef.current?.querySelector('button') as HTMLElement | null)?.focus(); }
    else if (e.key === 'Tab') close();
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openList(); }
    // typing straight onto the closed field starts a search
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openList(e.key); }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
        className={cn(
          'flex items-center gap-2 text-left focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
          hasError && 'border-destructive focus-visible:border-destructive focus-visible:shadow-[0_0_0_3px_hsl(var(--destructive)/0.3)]',
          className,
        )}
      >
        {leading}
        <span className={cn('flex-1 truncate', !shown && 'text-muted-foreground')}>{shown || placeholder}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div ref={popupRef} data-floating-popup="" style={position} className="fixed z-[9999] rounded-lg border bg-card text-foreground shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onSearchKey}
              placeholder={searchPlaceholder}
              aria-label={`Search ${ariaLabel}`}
              aria-controls={`${id}-list`}
              aria-activedescendant={items[active] ? `${id}-opt-${active}` : undefined}
              autoComplete="off"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={ariaLabel} className="max-h-60 overflow-y-auto py-1">
            {loading && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Loading…</li>}
            {!loading && items.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">No match for “{query}”</li>}
            {items.map((o, i) => (
              <li key={o.value} role="presentation">
                {!query && i === 0 && commonCount > 0 && <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Common</p>}
                {!query && i === commonCount && commonCount > 0 && <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-t mt-1">All</p>}
                <div
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  data-active={i === active}
                  onMouseMove={() => active !== i && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o.value)}
                  className={cn('flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm', i === active && 'bg-[hsl(var(--brand-accent))]/10')}
                >
                  <span className={cn('shrink-0 font-semibold', labelClassName)}>{o.label}</span>
                  <span className="flex-1 truncate text-muted-foreground">{o.description}</span>
                  {o.value === value && <Check className="h-4 w-4 text-[hsl(var(--brand-accent))] shrink-0" />}
                </div>
              </li>
            ))}
          </ul>

          {total > items.length && (
            <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">Showing {items.length} of {total}. Keep typing to narrow the list.</p>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

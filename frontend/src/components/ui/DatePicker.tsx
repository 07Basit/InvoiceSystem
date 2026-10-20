import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFloatingPosition } from '@/lib/useFloatingPosition';

interface DatePickerProps {
  /** "YYYY-MM-DD", or "" for no date. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  hasError?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad = (n: number) => String(n).padStart(2, '0');
export const toYmd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const y = Number(match[1]); const m = Number(match[2]) - 1; const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m && check.getUTCDate() === d ? { y, m, d } : null;
}

export function formatYmd(value: string): string {
  const p = parseYmd(value);
  return p ? `${pad(p.d)} ${MONTHS[p.m]!.slice(0, 3)} ${p.y}` : '';
}

/** Monday-first grid for a month: leading/trailing days from the neighbouring months fill whole weeks. */
export function monthGrid(year: number, month: number): { y: number; m: number; d: number; inMonth: boolean }[] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(Date.UTC(year, month, 1 - lead + i));
    return { y: day.getUTCFullYear(), m: day.getUTCMonth(), d: day.getUTCDate(), inMonth: day.getUTCMonth() === month };
  });
}

/** Themed calendar popover; replaces the browser's native date input. */
export default function DatePicker({ value, onChange, ariaLabel, hasError, disabled, className, placeholder = 'Select date' }: DatePickerProps) {
  const selected = parseYmd(value);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days');
  const [view, setView] = useState({ y: selected?.y ?? today.getFullYear(), m: selected?.m ?? today.getMonth() });
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const position = useFloatingPosition(open, rootRef, { width: 288, height: 360, onAnchorHidden: () => close() });

  const close = () => { setOpen(false); setMode('days'); };

  const openCalendar = () => {
    if (disabled) return;
    const p = parseYmd(value);
    setView({ y: p?.y ?? today.getFullYear(), m: p?.m ?? today.getMonth() });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (y: number, m: number, d: number) => { onChange(toYmd(y, m, d)); close(); };
  const shiftMonth = (delta: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const yearStart = Math.floor(view.y / 12) * 12;

  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const isToday = (y: number, m: number, d: number) => y === today.getFullYear() && m === today.getMonth() && d === today.getDate();

  const navBtn = 'h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent text-muted-foreground';

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKey}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? close() : openCalendar())}
        className={cn(
          'input flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 disabled:opacity-50',
          hasError ? 'border-destructive focus-visible:ring-destructive/60' : 'focus-visible:ring-ring',
          className,
        )}
      >
        <span className={cn('flex-1 truncate', !selected && 'text-muted-foreground')}>{selected ? formatYmd(value) : placeholder}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && createPortal(
        <div
          ref={popupRef} data-floating-popup=""
          role="dialog"
          aria-label={`${ariaLabel} calendar`}
          style={position}
          className="fixed z-[9999] rounded-lg border bg-card p-3 text-foreground shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label={mode === 'days' ? 'Previous month' : 'Previous years'} className={navBtn}
              onClick={() => (mode === 'days' ? shiftMonth(-1) : setView((v) => ({ ...v, y: v.y - (mode === 'years' ? 12 : 1) })))}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Change month or year" className="rounded-md px-2 py-1 text-sm font-semibold hover:bg-accent"
              onClick={() => setMode((m) => (m === 'days' ? 'months' : m === 'months' ? 'years' : 'days'))}>
              {mode === 'days' ? `${MONTHS[view.m]} ${view.y}` : mode === 'months' ? view.y : `${yearStart} – ${yearStart + 11}`}
            </button>
            <button type="button" aria-label={mode === 'days' ? 'Next month' : 'Next years'} className={navBtn}
              onClick={() => (mode === 'days' ? shiftMonth(1) : setView((v) => ({ ...v, y: v.y + (mode === 'years' ? 12 : 1) })))}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {mode === 'days' && (
            <>
              <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
                {WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {monthGrid(view.y, view.m).map((day) => {
                  const isSelected = selected?.y === day.y && selected.m === day.m && selected.d === day.d;
                  return (
                    <button
                      key={`${day.y}-${day.m}-${day.d}`}
                      type="button"
                      aria-label={`${day.d} ${MONTHS[day.m]} ${day.y}`}
                      aria-pressed={isSelected}
                      onClick={() => pick(day.y, day.m, day.d)}
                      className={cn(
                        'mx-auto h-8 w-8 rounded-full text-sm hover:bg-accent',
                        !day.inMonth && 'text-muted-foreground/50',
                        isToday(day.y, day.m, day.d) && !isSelected && 'border border-[hsl(var(--brand-accent))] font-semibold',
                        isSelected && 'bg-[hsl(var(--brand-accent))] font-semibold text-white hover:bg-[hsl(var(--brand-accent))]',
                      )}
                    >
                      {day.d}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-end border-t pt-2">
                <button type="button" className="text-xs font-semibold text-[hsl(var(--brand-accent))] hover:underline"
                  onClick={() => pick(today.getFullYear(), today.getMonth(), today.getDate())}>
                  Today
                </button>
              </div>
            </>
          )}

          {mode === 'months' && (
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((name, i) => (
                <button key={name} type="button" onClick={() => { setView((v) => ({ ...v, m: i })); setMode('days'); }}
                  className={cn('rounded-md py-2 text-sm hover:bg-accent', i === view.m && 'bg-[hsl(var(--brand-accent))]/10 font-semibold')}>
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {mode === 'years' && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, i) => yearStart + i).map((year) => (
                <button key={year} type="button" onClick={() => { setView((v) => ({ ...v, y: year })); setMode('months'); }}
                  className={cn('rounded-md py-2 text-sm hover:bg-accent', year === view.y && 'bg-[hsl(var(--brand-accent))]/10 font-semibold')}>
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

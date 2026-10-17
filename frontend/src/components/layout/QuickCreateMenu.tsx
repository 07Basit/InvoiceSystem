import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, FileText, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { label: 'New invoice', description: 'Start a blank invoice', to: '/invoices?new=1', icon: FileText },
  { label: 'New importer', description: 'Add a customer and its routes', to: '/importers?new=1', icon: Users },
] as const;

/** Top-bar shortcut: create an invoice or an importer from any page. */
export default function QuickCreateMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const choose = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--brand-accent))] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">New</span>
        <ChevronDown className={cn('hidden h-3.5 w-3.5 transition-transform sm:block', open && 'rotate-180')} />
        <span className="sr-only sm:hidden">Create new</span>
      </button>

      {open && (
        <div role="menu" className="absolute left-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border bg-card p-1.5 shadow-lg">
          {ITEMS.map(({ label, description, to, icon: Icon }) => (
            <button
              key={to}
              type="button"
              role="menuitem"
              onClick={() => choose(to)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-accent"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">{description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

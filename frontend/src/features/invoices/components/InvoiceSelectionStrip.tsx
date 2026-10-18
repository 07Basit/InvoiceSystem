import { CheckCheck, ListChecks, MousePointerClick, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoiceSelectionStripProps {
  selected: number;
  /** Invoices on this page, and how many of them are ticked */
  pageCount: number;
  pageSelected: number;
  /** Invoices matching the search and filters, across all pages */
  totalMatching: number;
  onSelectPage: () => void;
  onSelectAllMatching: () => void;
  onClear: () => void;
  selectingAll?: boolean;
}

function Chip({ active, onClick, disabled, children }: { active?: boolean; onClick: () => void; disabled?: boolean | undefined; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
        active ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent))] text-white' : 'bg-background hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}

/** Shown while selecting: how many are ticked, and one-tap ways to tick this page or everything that matches. */
export default function InvoiceSelectionStrip({ selected, pageCount, pageSelected, totalMatching, onSelectPage, onSelectAllMatching, onClear, selectingAll }: InvoiceSelectionStripProps) {
  const pageAll = pageCount > 0 && pageSelected === pageCount;
  const everything = totalMatching > 0 && selected >= totalMatching;
  const moreThanPage = totalMatching > pageCount;

  return (
    <div role="group" aria-label="Select invoices" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-dashed border-[hsl(var(--brand-accent))]/50 bg-[hsl(var(--brand-accent))]/5 px-4 py-3">
      <p className="flex items-center gap-2 text-sm" aria-live="polite">
        <MousePointerClick className="h-4 w-4 text-[hsl(var(--brand-accent))]" />
        {selected === 0 ? <span className="text-muted-foreground">Click invoices to select them</span> : <span className="font-semibold">{selected} of {totalMatching} selected</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={pageAll} onClick={onSelectPage}><ListChecks className="h-3.5 w-3.5" /> {pageAll ? 'Unselect this page' : `Select this page (${pageCount})`}</Chip>
        {moreThanPage && (
          <Chip active={everything} onClick={onSelectAllMatching} disabled={selectingAll}><CheckCheck className="h-3.5 w-3.5" /> {selectingAll ? 'Selecting…' : `Select all ${totalMatching}`}</Chip>
        )}
        {selected > 0 && (
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Clear</button>
        )}
      </div>
    </div>
  );
}

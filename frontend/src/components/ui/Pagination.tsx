import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pageItems } from '@/lib/pagination';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Plural noun for the count text, e.g. "invoices". */
  noun: string;
}

/**
 * "Showing 13-24 of 55 invoices" with Previous / numbered pages / Next. On a phone the numbers collapse
 * into "Page 2 of 5" so the bar never wraps. Renders nothing when everything fits on one page.
 */
export default function Pagination({ page, totalPages, total, pageSize, onPageChange, noun }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const go = (p: number) => { if (p >= 1 && p <= totalPages && p !== page) onPageChange(p); };

  const nav = 'inline-flex h-9 items-center justify-center gap-1 rounded-lg border bg-card px-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card';

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center gap-3 pb-14 pt-2 sm:flex-row sm:justify-between sm:pb-10">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing <span className="font-semibold text-foreground">{from}–{to}</span> of <span className="font-semibold text-foreground">{total}</span> {noun}
      </p>

      <div className="flex items-center gap-1.5">
        <button type="button" className={nav} onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span>
        </button>

        {/* phones: a short label instead of every page number */}
        <span className="px-2 text-sm font-medium sm:hidden">Page {page} of {totalPages}</span>

        <div className="hidden items-center gap-1 sm:flex">
          {pageItems(page, totalPages).map((item, i) =>
            item === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>…</span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => go(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={cn(
                  'h-9 min-w-9 rounded-lg border px-2 text-sm font-medium transition-colors',
                  item === page ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent))] text-white' : 'bg-card hover:bg-muted',
                )}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <button type="button" className={nav} onClick={() => go(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

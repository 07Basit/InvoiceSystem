import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  /** Where the crumb goes; the last crumb (the page you are on) has none. */
  to?: string;
}

/**
 * Where you are, and a way up. On a computer or tablet it is a trail (Home › Invoices › INV-123) where every
 * step before the current page is a link; on a phone it shrinks to a single "‹ Invoices" link to the parent.
 */
export default function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const parent = [...items].reverse().find((c) => c.to);

  return (
    <nav aria-label="Breadcrumb" className={cn('print:hidden', className)}>
      {parent?.to && (
        <Link to={parent.to} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground sm:hidden">
          <ChevronLeft className="h-4 w-4" /> {parent.label}
        </Link>
      )}
      <ol className="hidden min-w-0 flex-wrap items-center gap-1.5 text-sm sm:flex">
        <li className="flex items-center">
          <Link to="/" aria-label="Dashboard" className="rounded p-0.5 text-muted-foreground hover:text-foreground"><Home className="h-4 w-4" /></Link>
        </li>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              {item.to && !last ? (
                <Link to={item.to} className="truncate text-muted-foreground hover:text-foreground hover:underline">{item.label}</Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className="max-w-[24rem] truncate font-medium text-foreground">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

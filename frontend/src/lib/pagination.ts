import { useEffect, useState } from 'react';

/**
 * How many cards to load per page, by how many columns the grid shows.
 *
 * - 1 column (phones, tablets in portrait): 10 cards. A card is roughly 150-250px tall, so a page is
 *   about two screens of scrolling, enough to browse without an endless scroll.
 * - 2 columns (laptops and larger): 12 cards = 6 full rows, so every row on every page is complete
 *   (a page size that isn't a multiple of the column count leaves a half-empty last row).
 */
export const PAGE_SIZE_ONE_COLUMN = 10;
export const PAGE_SIZE_TWO_COLUMNS = 12;

/** Viewport widths (px) at which each page's card grid switches to 2 columns (Tailwind lg / xl). */
export const IMPORTERS_TWO_COLUMNS_FROM = 1024;
export const INVOICES_TWO_COLUMNS_FROM = 1280;

/** Page size for the current screen; follows the window as it is resized or rotated. */
export function usePageSize(twoColumnsFromPx: number): number {
  const query = `(min-width: ${twoColumnsFromPx}px)`;
  const read = () => (typeof window !== 'undefined' && window.matchMedia?.(query).matches ? PAGE_SIZE_TWO_COLUMNS : PAGE_SIZE_ONE_COLUMN);
  const [size, setSize] = useState(read);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = () => setSize(mq.matches ? PAGE_SIZE_TWO_COLUMNS : PAGE_SIZE_ONE_COLUMN);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return size;
}

/** Page numbers to show, with gaps as "…": 1 … 4 5 6 … 10. Always includes the first, last and current±1. */
export function pageItems(page: number, totalPages: number): Array<number | '…'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  // keep the strip a steady width near the ends
  if (page <= 3) { wanted.add(2); wanted.add(3); wanted.add(4); }
  if (page >= totalPages - 2) { wanted.add(totalPages - 1); wanted.add(totalPages - 2); wanted.add(totalPages - 3); }
  const sorted = [...wanted].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  sorted.forEach((n, i) => {
    if (i > 0) {
      const gap = n - sorted[i - 1]!;
      if (gap === 2) out.push(n - 1); // a lone skipped page is shown, not hidden behind "…"
      else if (gap > 2) out.push('…');
    }
    out.push(n);
  });
  return out;
}

/** Smoothly scroll the app's main content area back to the top (used when the page of results changes). */
export function scrollMainToTop(): void {
  const main = document.querySelector('main');
  if (!main) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  main.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}

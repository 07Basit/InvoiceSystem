/** ₹ 1,23,456.50 (Indian digit grouping) */
export const inr = (value: number, digits = 2) =>
  `₹ ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}`;

export const plainNumber = (value: number, digits = 2) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);

/** 2026-10-26 -> "26 Oct 2026" */
export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** A product name as the reports compare it: capitals, spacing and padding ignored. */
export const productKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** A name with a capital letter on each word ("ddf traders" -> "Ddf Traders"); capitals already typed are kept. */
export const titleCase = (name: string) => name.trim().replace(/\s+/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

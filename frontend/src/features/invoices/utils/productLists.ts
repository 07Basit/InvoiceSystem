import type { ProductList } from '../services/productListService';

/** The id used for the general list in the invoice form's list dropdown. */
export const GENERAL_LIST = 'general';

/** What an invoice is for: its importer, currency and landing location. */
export interface InvoiceListContext {
  importerId?: string | undefined;
  currency?: string | undefined;
  locationName?: string | undefined;
}

/** The importer's lists, best match for this invoice first (same currency and location, then same currency for all locations). */
export function listsForImporter(lists: ProductList[], context: InvoiceListContext): ProductList[] {
  const rank = (l: ProductList) => {
    if (l.currency !== context.currency) return 3;
    if (l.locationName && l.locationName === context.locationName) return 0;
    if (!l.locationName) return 1;
    return 2;
  };
  return lists
    .filter((l) => !!context.importerId && l.importerId === context.importerId)
    .sort((a, b) => rank(a) - rank(b) || a.currency.localeCompare(b.currency) || (a.locationName ?? '').localeCompare(b.locationName ?? ''));
}

/** The products scope a chosen list stands for (the general list has none). */
export function scopeOfList(list: ProductList | undefined): InvoiceListContext {
  return list ? { importerId: list.importerId, currency: list.currency, locationName: list.locationName ?? undefined } : {};
}

/** What a product list says about a product name: is it in the list, and what is its price? */
export function priceInList(
  products: Array<{ name: string; ratePerKg: string | null; isActive: boolean; importerId: string | null; currency: string | null; locationName: string | null }>,
  scope: InvoiceListContext,
  name: string,
): { found: boolean; price: number | null } {
  const wanted = name.trim().toLowerCase();
  const match = products.find((p) =>
    p.isActive
    && p.name.trim().toLowerCase() === wanted
    && (p.importerId ?? undefined) === scope.importerId
    && (p.currency ?? undefined) === scope.currency
    && (p.locationName ?? undefined) === scope.locationName);
  if (!match) return { found: false, price: null };
  const price = match.ratePerKg !== null ? Number(match.ratePerKg) : null;
  return { found: true, price: price !== null && price > 0 ? price : null };
}

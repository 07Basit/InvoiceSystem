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

type ListProduct = { name: string; ratePerKg: string | null; isActive: boolean; importerId: string | null; currency: string | null; locationName: string | null };

const nameKey = (name: string) => name.trim().toLowerCase();

/** The active products of one scope (general, or one importer + currency + location) by name: build once, look up in O(1). */
export function priceIndex(products: ListProduct[], scope: InvoiceListContext): Map<string, ListProduct> {
  const index = new Map<string, ListProduct>();
  for (const p of products) {
    if (!p.isActive) continue;
    if ((p.importerId ?? undefined) !== scope.importerId || (p.currency ?? undefined) !== scope.currency || (p.locationName ?? undefined) !== scope.locationName) continue;
    const key = nameKey(p.name);
    if (!index.has(key)) index.set(key, p); // the first match wins, as before
  }
  return index;
}

/** What a product list says about a product name: is it in the list, and what is its price? */
export function priceFrom(index: Map<string, ListProduct>, name: string): { found: boolean; price: number | null } {
  const match = index.get(nameKey(name));
  if (!match) return { found: false, price: null };
  const price = match.ratePerKg !== null ? Number(match.ratePerKg) : null;
  return { found: true, price: price !== null && price > 0 ? price : null };
}

/** One-off lookup. When pricing many lines, build `priceIndex` once and use `priceFrom` (O(L + P) instead of O(L * P)). */
export function priceInList(products: ListProduct[], scope: InvoiceListContext, name: string): { found: boolean; price: number | null } {
  return priceFrom(priceIndex(products, scope), name);
}

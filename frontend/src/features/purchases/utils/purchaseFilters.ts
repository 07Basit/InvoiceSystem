export type DateBasis = 'invoice' | 'purchase';

export interface PurchaseFilterValues {
  dateFrom: string;
  dateTo: string;
  /** Which date the range applies to on the invoice list */
  basis: DateBasis;
  supplierId: string;
  product: string;
}

export const noPurchaseFilters: PurchaseFilterValues = { dateFrom: '', dateTo: '', basis: 'invoice', supplierId: '', product: '' };

/** How many filters are set (shown on the Filters button). The date basis only matters together with a date. */
export const countActive = (f: PurchaseFilterValues) => (f.dateFrom || f.dateTo ? 1 : 0) + (f.supplierId ? 1 : 0) + (f.product.trim() ? 1 : 0);

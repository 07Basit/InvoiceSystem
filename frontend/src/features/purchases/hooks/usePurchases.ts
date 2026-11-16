import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListPurchasesQuery, PriceHistoryQuery, PriceOverviewQuery, PurchaseInvoiceDto, PurchaseReportQuery, PurchaseTemplate, SupplierDto } from 'shared';
import { purchaseService, supplierService } from '../services/purchaseService';

export const purchaseKeys = {
  all: ['purchases'] as const,
  suppliers: ['purchases', 'suppliers'] as const,
  list: (q: Partial<ListPurchasesQuery>) => ['purchases', 'list', q] as const,
  detail: (id: string) => ['purchases', 'detail', id] as const,
  report: (q: Partial<PurchaseReportQuery>) => ['purchases', 'report', q] as const,
  history: (q: PriceHistoryQuery) => ['purchases', 'history', q] as const,
  products: ['purchases', 'products'] as const,
  overview: (q: PriceOverviewQuery) => ['purchases', 'overview', q] as const,
  lastRates: ['purchases', 'last-rates'] as const,
};

// ---- suppliers

export function useSuppliers() {
  return useQuery({ queryKey: purchaseKeys.suppliers, queryFn: () => supplierService.list() });
}

export function useSupplierMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: purchaseKeys.suppliers });
  return {
    create: useMutation({ mutationFn: (dto: SupplierDto) => supplierService.create(dto), onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, dto }: { id: string; dto: SupplierDto }) => supplierService.update(id, dto), onSuccess: refresh }),
    setActive: useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => supplierService.setActive(id, isActive), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => supplierService.remove(id), onSuccess: refresh }),
  };
}

// ---- purchase invoices

export function usePurchases(query: Partial<ListPurchasesQuery>) {
  return useQuery({ queryKey: purchaseKeys.list(query), queryFn: () => purchaseService.list(query), placeholderData: keepPreviousData });
}

export function usePurchase(id: string | undefined) {
  return useQuery({ queryKey: purchaseKeys.detail(id ?? ''), queryFn: () => purchaseService.get(id!), enabled: Boolean(id) });
}

export function usePurchaseMutations() {
  const qc = useQueryClient();
  // reports, price history and the Products page's last rates all change with every saved invoice
  const refresh = () => qc.invalidateQueries({ queryKey: purchaseKeys.all });
  return {
    create: useMutation({ mutationFn: (dto: PurchaseInvoiceDto) => purchaseService.create(dto), onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, dto }: { id: string; dto: PurchaseInvoiceDto }) => purchaseService.update(id, dto), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => purchaseService.remove(id), onSuccess: refresh }),
    preview: useMutation({ mutationFn: ({ file, supplierId, template }: { file: File; supplierId?: string; template?: PurchaseTemplate }) => purchaseService.preview(file, { ...(supplierId ? { supplierId } : {}), ...(template ? { template } : {}) }) }),
  };
}

// ---- reports

export function usePurchaseReport(query: Partial<PurchaseReportQuery>) {
  return useQuery({ queryKey: purchaseKeys.report(query), queryFn: () => purchaseService.report(query), placeholderData: keepPreviousData });
}

export function usePriceHistory(query: PriceHistoryQuery | null) {
  return useQuery({ queryKey: purchaseKeys.history(query ?? { product: '' }), queryFn: () => purchaseService.priceHistory(query!), enabled: Boolean(query?.product) });
}

export function usePurchasedProducts() {
  return useQuery({ queryKey: purchaseKeys.products, queryFn: () => purchaseService.productNames() });
}

/** The latest rate each product was bought at, by lower-case product name (for the Products page). */
export function usePriceOverview(query: PriceOverviewQuery) {
  return useQuery({ queryKey: purchaseKeys.overview(query), queryFn: () => purchaseService.overview(query), staleTime: 30_000 });
}

export function useLastPurchaseRates() {
  return useQuery({
    queryKey: purchaseKeys.lastRates,
    queryFn: () => purchaseService.lastRates(),
    select: (rows) => new Map(rows.map((r) => [r.product.trim().replace(/\s+/g, ' ').toLowerCase(), r])),
    staleTime: 60_000,
  });
}

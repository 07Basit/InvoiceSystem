import { apiClient } from '@/services/api';
import type {
  ApiResponse, LastPurchaseRate, ListPurchasesQuery, ParsedPurchase, PriceHistory, PriceHistoryQuery, PriceOverviewItem, PriceOverviewQuery, PurchaseInvoiceDto, PurchaseReport, PurchaseReportQuery, PurchaseTemplate, SupplierDto,
} from 'shared';

export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  importTemplate: PurchaseTemplate | null;
  isActive: boolean;
  createdAt: string;
  _count?: { purchases: number };
}

export interface PurchaseLine {
  id: string;
  productName: string;
  description: string | null;
  quantity: number | null;
  netWeight: number | null;
  unit: string | null;
  rate: number;
  rateBasis: 'KG' | 'UNIT';
  amount: number;
}

export interface PurchaseInvoice {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  purchaseDate: string | null;
  dueDate: string | null;
  currency: string;
  subTotal: number;
  taxAmount: number;
  freight: number;
  otherCharges: number;
  total: number;
  notes: string | null;
  sourceFileName: string | null;
  /** The actual invoice this purchase was made for */
  invoiceId: string | null;
  invoice: { id: string; invoiceNumber: string; invoiceDate: string; currency: string; importerName: string | null } | null;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseLine[];
}

const unwrap = <T,>(reply: ApiResponse<T>): T => {
  if (reply.data === null || reply.data === undefined) throw new Error('The server sent no data');
  return reply.data;
};

export const supplierService = {
  async list() {
    const { data } = await apiClient.get<ApiResponse<Supplier[]>>('/suppliers');
    return unwrap(data);
  },
  async create(dto: SupplierDto) {
    const { data } = await apiClient.post<ApiResponse<Supplier>>('/suppliers', dto);
    return unwrap(data);
  },
  async update(id: string, dto: SupplierDto) {
    const { data } = await apiClient.put<ApiResponse<Supplier>>(`/suppliers/${id}`, dto);
    return unwrap(data);
  },
  async setActive(id: string, isActive: boolean) {
    const { data } = await apiClient.patch<ApiResponse<Supplier>>(`/suppliers/${id}/active`, { isActive });
    return unwrap(data);
  },
  async remove(id: string) {
    await apiClient.delete(`/suppliers/${id}`);
  },
};

export const purchaseService = {
  async list(query: Partial<ListPurchasesQuery>) {
    const { data } = await apiClient.get<ApiResponse<PurchaseInvoice[]>>('/purchases', { params: query });
    return { rows: unwrap(data), meta: data.meta };
  },
  async get(id: string) {
    const { data } = await apiClient.get<ApiResponse<PurchaseInvoice>>(`/purchases/${id}`);
    return unwrap(data);
  },
  async create(dto: PurchaseInvoiceDto) {
    const { data } = await apiClient.post<ApiResponse<PurchaseInvoice>>('/purchases', dto);
    return unwrap(data);
  },
  async update(id: string, dto: PurchaseInvoiceDto) {
    const { data } = await apiClient.put<ApiResponse<PurchaseInvoice>>(`/purchases/${id}`, dto);
    return unwrap(data);
  },
  async remove(id: string) {
    await apiClient.delete(`/purchases/${id}`);
  },
  /** Reads an Excel invoice; nothing is saved. `template` tries a template that is not saved yet. */
  async preview(file: File, options: { supplierId?: string; template?: PurchaseTemplate } = {}) {
    const form = new FormData();
    form.append('file', file);
    if (options.supplierId) form.append('supplierId', options.supplierId);
    if (options.template) form.append('template', JSON.stringify(options.template));
    const { data } = await apiClient.post<ApiResponse<ParsedPurchase>>('/purchases/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 });
    return unwrap(data);
  },
  async report(query: Partial<PurchaseReportQuery>) {
    const { data } = await apiClient.get<ApiResponse<PurchaseReport>>('/purchases/reports/summary', { params: query });
    return unwrap(data);
  },
  async priceHistory(query: PriceHistoryQuery) {
    const { data } = await apiClient.get<ApiResponse<PriceHistory>>('/purchases/reports/price-history', { params: query });
    return unwrap(data);
  },
  async overview(query: PriceOverviewQuery) {
    const { data } = await apiClient.get<ApiResponse<PriceOverviewItem[]>>('/purchases/reports/overview', { params: query });
    return unwrap(data);
  },
  async productNames() {
    const { data } = await apiClient.get<ApiResponse<{ product: string; lines: number }[]>>('/purchases/reports/products');
    return unwrap(data);
  },
  async lastRates() {
    const { data } = await apiClient.get<ApiResponse<LastPurchaseRate[]>>('/purchases/reports/last-rates');
    return unwrap(data);
  },
};

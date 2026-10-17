import { apiClient } from '@/services/api';
import type { ApiResponse, CreateInvoiceDto, ListInvoicesQuery, UpdateInvoiceDto } from 'shared';

export interface InvoiceLineItem {
  id: string;
  marksAndNos?: string | null;
  containerNo?: string | null;
  descriptionOfGoods: string;
  netWeightPerPackage: number;
  numberOfBoxes: number;
  totalNetWeight: number;
  ratePerKg: number;
  totalPerBox: number;
  amount: number;
}

export interface InvoiceImporter {
  id: string;
  name: string;
  currency: string;
  /** present on the detail endpoint */
  address?: string | null;
  contact?: string | null;
  email?: string | null;
}

export interface InvoiceSummary {
  total: number;
  thisMonth: number;
  /** sum of all invoices converted into baseCurrency */
  totalValue: number;
  baseCurrency: string;
  /** invoices with no exchange rate, so left out of totalValue */
  notInRevenue: number;
}

export interface InvoiceConversion {
  baseCurrency: string;
  source: 'same' | 'auto' | 'manual' | 'missing';
  /** reporting-currency units per 1 invoice-currency unit */
  rate: number | null;
  value: number | null;
  /** which service the automatic rate came from */
  provider?: 'ECB' | 'EXCHANGERATE_API' | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  importerId: string;
  importer: InvoiceImporter;
  landingLocationId?: string | null;
  loadingLocationId?: string | null;
  exportersRef?: string | null;
  otherReferences?: string | null;
  awbNumber?: string | null;
  preCarriageBy?: string | null;
  placeOfReceiptByPreCarrier?: string | null;
  vesselFlightNo?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  finalDestination?: string | null;
  buyerName?: string | null;
  countryOfOrigin?: string | null;
  countryOfDestination?: string | null;
  descriptionOfGoods?: string | null;
  hsCode?: string | null;
  termsOfDelivery?: string | null;
  termsOfPayment?: string | null;
  currency: string;
  landingLocation?: { name: string } | null;
  loadingLocation?: { name: string } | null;
  /** No exchange rate available, so the invoice is left out of dashboard revenue */
  excludedFromRevenue?: boolean;
  /** Only on the detail endpoint: how the invoice is valued in the reporting currency */
  conversion?: InvoiceConversion;
  exporterName?: string | null;
  exporterAddress?: string | null;
  exporterContact?: string | null;
  exporterEmail?: string | null;
  lineItems: InvoiceLineItem[];
  totalBoxes: number;
  totalNetWeight: number;
  totalGrossWeight?: number | null;
  subTotal: number;
  roundOff: number;
  total: number;
  amountInWords?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceListItem extends Omit<Invoice, 'lineItems'> {}

export const invoiceService = {
  async getAll(query: Partial<ListInvoicesQuery> = {}) {
    const { data } = await apiClient.get<ApiResponse<InvoiceListItem[]>>('/invoices', { params: query });
    return data;
  },

  async getSummary() {
    const { data } = await apiClient.get<ApiResponse<InvoiceSummary>>('/invoices/summary');
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get<ApiResponse<Invoice>>(`/invoices/${id}`);
    return data;
  },

  async create(dto: CreateInvoiceDto) {
    const { data } = await apiClient.post<ApiResponse<Invoice>>('/invoices', dto);
    return data;
  },

  async update(id: string, dto: UpdateInvoiceDto) {
    const { data } = await apiClient.put<ApiResponse<Invoice>>(`/invoices/${id}`, dto);
    return data;
  },

  async setManualRate(id: string, rate: number) {
    const { data } = await apiClient.put<ApiResponse<Invoice>>(`/invoices/${id}/exchange-rate`, { rate });
    return data;
  },

  async clearManualRate(id: string) {
    const { data } = await apiClient.delete<ApiResponse<Invoice>>(`/invoices/${id}/exchange-rate`);
    return data;
  },

  async delete(id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/invoices/${id}`);
    return data;
  },

  downloadPdf(id: string) {
    return downloadFile(`/invoices/${id}/download/pdf`, `invoice-${id}.pdf`);
  },

  downloadExcel(id: string) {
    return downloadFile(`/invoices/${id}/download/excel`, `invoice-${id}.xlsx`);
  },

  exportAll() {
    return downloadFile('/invoices/export', 'invoices-export.xlsx');
  },
};

// Plain links can't send the Authorization header, so fetch the file as a blob and save it.
async function downloadFile(path: string, fallbackName: string): Promise<void> {
  try {
    const response = await apiClient.get<Blob>(path, { responseType: 'blob' });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const filename = match?.[1] ? decodeURIComponent(match[1]) : fallbackName;

    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch (error) {
    window.alert(error instanceof Error ? `Download failed: ${error.message}` : 'Download failed.');
  }
}

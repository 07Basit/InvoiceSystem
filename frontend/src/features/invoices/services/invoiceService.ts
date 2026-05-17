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
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
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

  async delete(id: string) {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/invoices/${id}`);
    return data;
  },

  downloadPdf(id: string) {
    window.open(`/api/v1/invoices/${id}/download/pdf`, '_blank');
  },

  downloadExcel(id: string) {
    window.open(`/api/v1/invoices/${id}/download/excel`, '_blank');
  },

  exportAll() {
    window.open('/api/v1/invoices/export', '_blank');
  },
};

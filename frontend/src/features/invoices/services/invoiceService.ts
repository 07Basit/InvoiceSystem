import { apiClient } from '@/services/api';
import { saveBlob } from '@/lib/share';
import type { ApiResponse, CreateInvoiceDto, ListInvoicesInput, UpdateInvoiceDto } from 'shared';

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
  /** same, for invoices dated this month only */
  monthValue: number;
  baseCurrency: string;
  /** invoices with no exchange rate, so left out of totalValue */
  notInRevenue: number;
  /** years and currencies that actually occur in the invoices, for the filter dropdowns */
  years: number[];
  currencies: string[];
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
  buyersOrder?: string | null;
  preCarriageBy?: string | null;
  placeOfReceiptByPreCarrier?: string | null;
  vesselFlightNo?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  finalDestination?: string | null;
  buyerName?: string | null;
  /** The importer's details as printed on this invoice (copied when it was made; later importer edits don't change them) */
  importerName?: string | null;
  importerAddress?: string | null;
  importerContact?: string | null;
  importerEmail?: string | null;
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
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfscCode?: string | null;
  bankSwiftCode?: string | null;
  /** Set on an "actual" invoice: the invoice it was made from */
  actualOfId?: string | null;
  actualOf?: { id: string; invoiceNumber: string } | null;
  /** The actual invoice made from this one, if there is one (at most one) */
  actuals?: { id: string; invoiceNumber: string }[];
  /** NORMAL (the default), PARTY, CUSTOM or BOTH (a party page and a custom page in one invoice). Only party and custom invoices have a partner. */
  invoiceKind?: 'NORMAL' | 'PARTY' | 'CUSTOM' | 'BOTH';
  /** The hidden custom page of a BOTH invoice; it never shows on its own */
  isCompanion?: boolean;
  /** Set on a party / custom partner: the invoice it was copied from; and the partner made from this invoice, if any (at most one) */
  counterpartOfId?: string | null;
  counterpartOf?: { id: string; invoiceNumber: string; invoiceKind: 'PARTY' | 'CUSTOM' } | null;
  counterparts?: { id: string; invoiceNumber: string; invoiceKind: 'PARTY' | 'CUSTOM' }[];
  /** The number printed inside a copy's documents (the number of the invoice it was made from) */
  printedNumber?: string | null;
  lineItems: InvoiceLineItem[];
  totalBoxes: number;
  totalNetWeight: number;
  totalGrossWeight?: number | null;
  subTotal: number;
  roundOff: number;
  total: number;
  amountInWords?: string | null;
  notes?: string | null;
  declaration?: string | null;
  signName?: string | null;
  signImage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceListItem extends Omit<Invoice, 'lineItems'> {}

/** Whether "Create actual invoice" can be used, and the text to show on the button. */
export function actualInvoiceState(invoice: Pick<Invoice, 'actualOfId' | 'actuals'>): { canCreate: boolean; label: string } {
  if (invoice.actualOfId) return { canCreate: false, label: 'This is already the actual invoice' };
  if (invoice.actuals && invoice.actuals.length > 0) return { canCreate: false, label: 'Actual invoice already created' };
  return { canCreate: true, label: 'Create actual invoice' };
}

/** The number to show for an invoice inside its documents and forms: copies carry the number of the invoice they were made from. */
export const printedNumberOf = (invoice: Pick<Invoice, 'invoiceNumber' | 'printedNumber' | 'actualOf'>) =>
  invoice.printedNumber || invoice.actualOf?.invoiceNumber || invoice.invoiceNumber;

/** The tag shown for an invoice type; a normal invoice has none. */
export function kindTag(kind: Invoice['invoiceKind']): { label: string; className: string } | null {
  switch (kind) {
    case 'PARTY': return { label: 'Party', className: 'bg-muted text-muted-foreground' };
    case 'CUSTOM': return { label: 'Custom', className: 'border-sky-200 bg-sky-50 text-sky-700' };
    case 'BOTH': return { label: 'Party + Custom', className: 'border-violet-200 bg-violet-50 text-violet-700' };
    default: return null;
  }
}

/** A custom invoice never has an actual invoice. */
export const canHaveActual = (invoice: Pick<Invoice, 'invoiceKind'>) => invoice.invoiceKind !== 'CUSTOM';

/**
 * The party / custom switch: a party invoice makes a custom one and a custom invoice makes a party one, each with at most one
 * partner. A normal invoice and an actual invoice have no such button (`available` is false).
 */
export function counterpartState(invoice: Pick<Invoice, 'invoiceKind' | 'actualOfId' | 'counterpartOfId' | 'counterpartOf' | 'counterparts'>): { available: boolean; canCreate: boolean; label: string; target: 'Party' | 'Custom' } {
  const target = invoice.invoiceKind === 'CUSTOM' ? 'Party' : 'Custom';
  // a normal invoice has no partner, and an actual invoice cannot have one either
  if ((invoice.invoiceKind !== 'PARTY' && invoice.invoiceKind !== 'CUSTOM') || invoice.actualOfId) return { available: false, canCreate: false, label: '', target };
  const partner = invoice.counterpartOf ?? invoice.counterparts?.[0];
  if (invoice.counterpartOfId || partner) return { available: true, canCreate: false, label: `${partner?.invoiceKind === 'CUSTOM' ? 'Custom' : 'Party'} invoice already created`, target };
  return { available: true, canCreate: true, label: `Create ${target.toLowerCase()} invoice`, target };
}

export interface InvoiceFilterOptions {
  years: number[];
  currencies: string[];
  loadingPorts: string[];
  dischargePorts: string[];
  countries: string[];
  exporters: string[];
  products: string[];
}

export const invoiceService = {
  async getAll(query: Partial<ListInvoicesInput> = {}) {
    const { data } = await apiClient.get<ApiResponse<InvoiceListItem[]>>('/invoices', { params: query });
    return data;
  },

  /** The values the filter panel can offer (years, currencies, ports, countries, exporters, products). */
  async getFilterOptions() {
    const { data } = await apiClient.get<ApiResponse<InvoiceFilterOptions>>('/invoices/filter-options');
    return data.data!;
  },

  async getSummary() {
    const { data } = await apiClient.get<ApiResponse<InvoiceSummary>>('/invoices/summary');
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get<ApiResponse<Invoice>>(`/invoices/${id}`);
    return data;
  },

  /** Copies this invoice into "ACTUAL <number>" with all the same content. */
  async createActual(id: string) {
    const { data } = await apiClient.post<ApiResponse<Invoice>>(`/invoices/${id}/actual`);
    return data;
  },

  /** Copies this invoice into its other kind (custom from party, party from custom) with all the same content. */
  async createCounterpart(id: string) {
    const { data } = await apiClient.post<ApiResponse<Invoice>>(`/invoices/${id}/counterpart`);
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

  /** The invoice as a file in memory (for sharing), without saving it. */
  getDocument(id: string, kind: 'pdf' | 'excel') {
    return fetchFile(`/invoices/${id}/download/${kind}`, `invoice-${id}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`);
  },

  /** What the server can do on this computer when it is the one running the app (a Mac or Windows PC, local only). */
  async nativeShareStatus(): Promise<{ available: boolean; copyFile: boolean }> {
    try {
      const { data } = await apiClient.get<ApiResponse<{ available: boolean; copyFile?: boolean }>>('/invoices/share/native');
      return { available: !!data.data?.available, copyFile: !!data.data?.copyFile };
    } catch {
      return { available: false, copyFile: false };
    }
  },

  /** Opens Mail with the file attached, or puts the file on the clipboard, on the computer running the server. */
  async shareNative(id: string, kind: 'pdf' | 'excel', target: 'mail' | 'whatsapp' | 'clipboard', text?: string) {
    const { data } = await apiClient.post<ApiResponse<{ target: string; filename: string; opened: 'mail' | 'app' | 'none' | 'clipboard' }>>(`/invoices/${id}/share/native`, { kind, target, ...(text ? { text } : {}) });
    return data.data!;
  },

  /** Opens the browser's print dialog for the invoice PDF (the same document as the download). */
  async printPdf(id: string) {
    const file = await fetchFile(`/invoices/${id}/download/pdf?disposition=inline`, `invoice-${id}.pdf`);
    await printBlob(file.blob);
  },

  /** Every invoice id matching the search and filters, for "select all matching". */
  async listIds(query: Partial<ListInvoicesInput>) {
    const { data } = await apiClient.get<ApiResponse<{ ids: string[]; truncated: boolean }>>('/invoices/ids', { params: query });
    return data.data!;
  },

  /** Delete several invoices; the ones that can't be deleted are listed in `failed`. */
  async bulkDelete(ids: string[]) {
    const { data } = await apiClient.post<ApiResponse<{ deleted: string[]; failed: { id: string; message: string }[] }>>('/invoices/bulk-delete', { ids });
    return data.data!;
  },

  /** One ZIP with the PDF and/or Excel file of every invoice, as a file in memory. */
  async getZip(ids: string[], formats: ('pdf' | 'excel')[]): Promise<{ blob: Blob; filename: string }> {
    const response = await apiClient.post<Blob>('/invoices/zip', { ids, formats }, { responseType: 'blob' });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    return { blob: response.data, filename: match?.[1] ? decodeURIComponent(match[1]) : `invoices-${ids.length}.zip` };
  },

  /** Puts the ZIP on the clipboard of the computer running the app (only where that is supported). */
  async copyZip(ids: string[], formats: ('pdf' | 'excel')[], text?: string) {
    const { data } = await apiClient.post<ApiResponse<{ filename: string }>>('/invoices/zip/clipboard', { ids, formats, ...(text ? { text } : {}) });
    return data.data!;
  },

  exportAll() {
    return downloadFile('/invoices/export', 'invoices-export.xlsx');
  },
};

export interface FetchedFile {
  blob: Blob;
  filename: string;
}

// Plain links can't send the Authorization header, so files are fetched as a blob through the API client.
async function fetchFile(path: string, fallbackName: string): Promise<FetchedFile> {
  const response = await apiClient.get<Blob>(path, { responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return { blob: response.data, filename: match?.[1] ? decodeURIComponent(match[1]) : fallbackName };
}

/** Saves the file; rejects (so the caller can tell the user) when the server or network fails. */
async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const { blob, filename } = await fetchFile(path, fallbackName);
  saveBlob(blob, filename);
}

/**
 * Prints a PDF blob through a hidden frame so the app page itself is never printed.
 * Falls back to opening the PDF in a new tab (print from its viewer) if the frame cannot print.
 */
export function printBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  return new Promise<void>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    const cleanup = () => {
      setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
    };
    frame.onload = () => {
      // give the built-in PDF viewer a moment to lay the document out before printing it
      setTimeout(() => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
          cleanup();
          resolve();
        } catch {
          const opened = window.open(url, '_blank');
          cleanup();
          if (opened) resolve();
          else reject(new Error('Your browser blocked the print window. Allow pop-ups for this site and try again.'));
        }
      }, 400);
    };
    frame.src = url;
    document.body.appendChild(frame);
  });
}

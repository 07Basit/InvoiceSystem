import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api';
import { invoiceService } from '../services/invoiceService';

// Plain links can't send the session cookie reliably across hosts, so downloads go through the API client.
let clicked: HTMLAnchorElement | undefined;

beforeEach(() => {
  clicked = undefined;
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked = this;
  });
  vi.spyOn(window, 'open').mockImplementation(() => null);
});
afterEach(() => vi.restoreAllMocks());

const blobResponse = (disposition?: string) => ({
  data: new Blob(['x']),
  headers: disposition ? { 'content-disposition': disposition } : {},
});

describe('invoiceService downloads', () => {
  it('downloads the PDF through the API client using the server filename', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(blobResponse('attachment; filename="INV-0001.pdf"'));
    await invoiceService.downloadPdf('abc');
    expect(get).toHaveBeenCalledWith('/invoices/abc/download/pdf', { responseType: 'blob' });
    expect(clicked?.download).toBe('INV-0001.pdf');
    expect(clicked?.href).toBe('blob:mock');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('downloads Excel and the full export', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(blobResponse('attachment; filename="invoices-export.xlsx"'));
    await invoiceService.downloadExcel('abc');
    expect(get).toHaveBeenLastCalledWith('/invoices/abc/download/excel', { responseType: 'blob' });
    await invoiceService.exportAll();
    expect(get).toHaveBeenLastCalledWith('/invoices/export', { responseType: 'blob' });
    expect(clicked?.download).toBe('invoices-export.xlsx');
  });

  it('falls back to a sensible filename when the header is missing', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(blobResponse());
    await invoiceService.downloadPdf('abc');
    expect(clicked?.download).toBe('invoice-abc.pdf');
  });

  it('tells the user when a download fails instead of failing silently', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Your session has expired.'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await invoiceService.downloadPdf('abc');
    expect(alert).toHaveBeenCalledWith('Download failed: Your session has expired.');
    expect(clicked).toBeUndefined();
  });
});

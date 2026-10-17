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

  it('rejects when a download fails so the caller can tell the user', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Your session has expired.'));
    await expect(invoiceService.downloadPdf('abc')).rejects.toThrow('Your session has expired.');
    expect(clicked).toBeUndefined();
  });
});

describe('invoiceService.printPdf', () => {
  it('fetches the inline PDF and prints it from a hidden frame', async () => {
    vi.useFakeTimers();
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(blobResponse('inline; filename="INV-1.pdf"'));
    const print = vi.fn();
    const created: HTMLIFrameElement[] = [];
    const realAppend = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, 'appendChild').mockImplementation(((node: Node) => {
      if (node instanceof HTMLIFrameElement) {
        created.push(node);
        Object.defineProperty(node, 'contentWindow', { value: { focus: vi.fn(), print } });
        setTimeout(() => node.onload?.(new Event('load')), 0);
      }
      return realAppend(node);
    }) as typeof document.body.appendChild);

    const done = invoiceService.printPdf('abc');
    await vi.advanceTimersByTimeAsync(1000);
    await done;

    expect(get).toHaveBeenCalledWith('/invoices/abc/download/pdf?disposition=inline', { responseType: 'blob' });
    expect(print).toHaveBeenCalledTimes(1);
    expect(created[0]?.src).toBe('blob:mock');
    vi.useRealTimers();
  });

  it('falls back to a new tab when the frame cannot print', async () => {
    vi.useFakeTimers();
    vi.spyOn(apiClient, 'get').mockResolvedValue(blobResponse());
    const realAppend = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, 'appendChild').mockImplementation(((node: Node) => {
      if (node instanceof HTMLIFrameElement) {
        Object.defineProperty(node, 'contentWindow', { value: { focus: vi.fn(), print: () => { throw new Error('no'); } } });
        setTimeout(() => node.onload?.(new Event('load')), 0);
      }
      return realAppend(node);
    }) as typeof document.body.appendChild);
    (window.open as unknown as ReturnType<typeof vi.fn>).mockReturnValue({} as Window);

    const done = invoiceService.printPdf('abc');
    await vi.advanceTimersByTimeAsync(1000);
    await done;
    expect(window.open).toHaveBeenCalledWith('blob:mock', '_blank');
    vi.useRealTimers();
  });

  it('says so when even the new tab is blocked', async () => {
    vi.useFakeTimers();
    vi.spyOn(apiClient, 'get').mockResolvedValue(blobResponse());
    const realAppend = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, 'appendChild').mockImplementation(((node: Node) => {
      if (node instanceof HTMLIFrameElement) {
        Object.defineProperty(node, 'contentWindow', { value: { focus: vi.fn(), print: () => { throw new Error('no'); } } });
        setTimeout(() => node.onload?.(new Event('load')), 0);
      }
      return realAppend(node);
    }) as typeof document.body.appendChild);

    const done = invoiceService.printPdf('abc');
    const assertion = expect(done).rejects.toThrow(/blocked the print window/);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    vi.useRealTimers();
  });
});

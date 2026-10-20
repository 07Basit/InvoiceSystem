import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareInvoiceDialog from '../components/ShareInvoiceDialog';
import { invoiceService } from '../services/invoiceService';
import { ToastProvider } from '@/components/ui/toast';

const invoice = {
  id: 'i1', invoiceNumber: 'INV-1', invoiceDate: '2026-10-17T00:00:00.000Z', currency: 'EUR', total: 2570.4,
  exporterName: 'Green Harvest', importerName: 'ABC Foods',
};

const doc = (name: string) => ({ blob: new Blob(['data']), filename: name });

function setup(onClose = vi.fn()) {
  render(<ToastProvider><ShareInvoiceDialog invoice={invoice} onClose={onClose} /></ToastProvider>);
  return { onClose, user: userEvent.setup() };
}

let saved: HTMLAnchorElement[] = [];
beforeEach(() => {
  saved = [];
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { saved.push(this); });
  vi.spyOn(window, 'open').mockImplementation(() => null);
  vi.spyOn(invoiceService, 'getDocument').mockImplementation(async (_id, kind) => doc(kind === 'pdf' ? 'invoice-INV-1.pdf' : 'invoice-INV-1.xlsx'));
});
afterEach(() => { vi.restoreAllMocks(); Object.assign(navigator, { share: undefined, canShare: undefined }); });

describe('ShareInvoiceDialog', () => {
  it('prepares the PDF first and offers sharing, download and copy (nothing to type)', async () => {
    setup();
    expect(await screen.findByText(/invoice-INV-1\.pdf/)).toBeInTheDocument();
    expect(invoiceService.getDocument).toHaveBeenCalledWith('i1', 'pdf');
    expect(screen.getByRole('radio', { name: /PDF/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /Share to an app/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Copy message/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mail/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('switches to Excel and prepares that file instead', async () => {
    const { user } = setup();
    await screen.findByText(/\.pdf/);
    await user.click(screen.getByRole('radio', { name: /Excel/ }));
    expect(await screen.findByText(/invoice-INV-1\.xlsx/)).toBeInTheDocument();
    expect(invoiceService.getDocument).toHaveBeenLastCalledWith('i1', 'excel');
  });

  it('offers the device share sheet when the browser supports files, and shares the prepared file', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    const { user, onClose } = setup();
    await user.click(await screen.findByRole('button', { name: /Share to an app/ }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const arg = share.mock.calls[0]![0] as { files: File[]; title: string };
    expect(arg.files[0]!.name).toBe('invoice-INV-1.pdf');
    expect(arg.files[0]!.type).toBe('application/pdf');
    expect(arg.title).toBe('Invoice INV-1');
    expect((arg as unknown as { text: string }).text).toBe('Invoice INV-1\n\nHello,\n\nPlease find attached invoice INV-1 dated Oct 17, 2026.\n\nThank you.');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('always shows "Share to an app", and explains itself when the browser cannot share files', async () => {
    const { user } = setup();
    await screen.findByText(/\.pdf/);
    const button = screen.getByRole('button', { name: /Share to an app/ });
    expect(button).toBeInTheDocument();
    expect(screen.getByText(/Works on phones, Windows and Safari/)).toBeInTheDocument();
    await user.click(button);
    expect(await screen.findByText("This browser can't share files to other apps")).toBeInTheDocument();
  });

  it('shows the problem and lets you retry when the file cannot be prepared', async () => {
    vi.spyOn(invoiceService, 'getDocument').mockRejectedValueOnce(new Error('Server error')).mockResolvedValue(doc('invoice-INV-1.pdf'));
    const { user } = setup();
    expect(await screen.findByText('Server error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/invoice-INV-1\.pdf/)).toBeInTheDocument();
  });

  it('closes on Escape and on the close button', async () => {
    const { user, onClose } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('ShareInvoiceDialog when the browser refuses a file type (Excel in Chrome and Brave)', () => {
  const pdfOnly = (d: { files: File[] }) => d.files[0]!.type === 'application/pdf';

  it('greys out Share to an app for Excel and tells the user to download and share it', async () => {
    Object.assign(navigator, { share: vi.fn(), canShare: () => true });
    const { user } = setup();
    await screen.findByText(/\.pdf/);
    expect(screen.getByRole('button', { name: /Share to an app/ })).toBeEnabled();
    await user.click(screen.getByRole('radio', { name: /Excel/ }));
    await screen.findByText(/\.xlsx/);
    expect(screen.getByRole('button', { name: /Share to an app/ })).toBeDisabled();
    expect(screen.getByText(/Excel files can't be shared from here\. Please download the file and share it\./)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /PDF/ }));
    await screen.findByText(/\.pdf/);
    expect(screen.getByRole('button', { name: /Share to an app/ })).toBeEnabled();
  });

  it('still shares the PDF through the share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: pdfOnly });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: /Share to an app/ }));
    await waitFor(() => expect(share).toHaveBeenCalled());
  });

  it('explains when the browser says "Permission denied" at the last moment, without downloading', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    Object.assign(navigator, { share, canShare: () => true });
    const before = saved.length;
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: /Share to an app/ }));
    expect(await screen.findByText(/can't share PDF files to other apps/)).toBeInTheDocument();
    expect(saved.length).toBe(before);
  });
});

describe('ShareInvoiceDialog buttons', () => {
  it('offers Download and Share to an app, and no copy buttons', async () => {
    setup();
    await screen.findByText(/\.pdf/);
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copy file/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copy message/ })).not.toBeInTheDocument();
  });
});

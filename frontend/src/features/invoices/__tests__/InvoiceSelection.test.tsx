import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoiceCard from '../components/InvoiceCard';
import InvoiceSelectionBar, { downloadLabel } from '../components/InvoiceSelectionBar';
import InvoiceSelectionStrip from '../components/InvoiceSelectionStrip';
import ShareInvoicesDialog, { bulkMessage } from '../components/ShareInvoicesDialog';
import { invoiceService, type InvoiceListItem } from '../services/invoiceService';
import { useInvoiceStore } from '../store/invoiceStore';
import { ToastProvider } from '@/components/ui/toast';

const invoice = {
  id: 'inv1', invoiceNumber: 'INV-2026-001', invoiceDate: '2026-09-15T00:00:00.000Z', createdAt: '2026-09-15T00:00:00.000Z', updatedAt: '2026-09-15T00:00:00.000Z',
  importerId: 'imp1', importer: { id: 'imp1', name: 'North Maple Foods', currency: 'CAD' }, currency: 'CAD', total: 1500, subTotal: 1500, roundOff: 0, totalBoxes: 1, totalNetWeight: 10, excludedFromRevenue: false,
} as unknown as InvoiceListItem;
const handlers = () => ({ onOpen: vi.fn(), onPdf: vi.fn(), onExcel: vi.fn(), onPrint: vi.fn(), onShare: vi.fn(), onCreateActual: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() });

describe('InvoiceCard in selection mode', () => {
  it('selects on click instead of opening, with no checkbox', async () => {
    const h = handlers();
    const onToggleSelect = vi.fn();
    render(<InvoiceCard invoice={invoice} {...h} selectionMode selected={false} onToggleSelect={onToggleSelect} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('INV-2026-001'));
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('can be selected from the keyboard and says whether it is selected', async () => {
    const onToggleSelect = vi.fn();
    render(<InvoiceCard invoice={invoice} {...handlers()} selectionMode selected onToggleSelect={onToggleSelect} />);
    const card = screen.getByRole('button', { name: 'Unselect invoice INV-2026-001' });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    card.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onToggleSelect).toHaveBeenCalledTimes(2);
  });

  it('opens normally outside selection mode', async () => {
    const h = handlers();
    render(<InvoiceCard invoice={invoice} {...h} />);
    await userEvent.click(screen.getByText('INV-2026-001'));
    expect(h.onOpen).toHaveBeenCalled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('InvoiceSelectionStrip', () => {
  const props = () => ({ onSelectPage: vi.fn(), onSelectAllMatching: vi.fn(), onClear: vi.fn() });

  it('invites you to click invoices while nothing is selected', () => {
    render(<InvoiceSelectionStrip selected={0} pageCount={10} pageSelected={0} totalMatching={49} {...props()} />);
    expect(screen.getByText('Click invoices to select them')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Clear/ })).not.toBeInTheDocument();
  });

  it('selects this page, then everything that matches', async () => {
    const p = props();
    render(<InvoiceSelectionStrip selected={0} pageCount={10} pageSelected={0} totalMatching={49} {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Select this page (10)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Select all 49' }));
    expect(p.onSelectPage).toHaveBeenCalled();
    expect(p.onSelectAllMatching).toHaveBeenCalled();
  });

  it('shows the count, and unselects the page once it is all selected', async () => {
    const p = props();
    render(<InvoiceSelectionStrip selected={10} pageCount={10} pageSelected={10} totalMatching={49} {...p} />);
    expect(screen.getByText('10 of 49 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unselect this page' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Clear/ }));
    expect(p.onClear).toHaveBeenCalled();
  });

  it('has no "select all" chip when everything fits on one page', () => {
    render(<InvoiceSelectionStrip selected={0} pageCount={5} pageSelected={0} totalMatching={5} {...props()} />);
    expect(screen.queryByRole('button', { name: /Select all/ })).not.toBeInTheDocument();
  });
});

describe('invoice store selection', () => {
  beforeEach(() => useInvoiceStore.setState({ selectionMode: false, selectedIds: [], search: '', page: 1 }));

  it('ticks, unticks and adds many at once', () => {
    const s = () => useInvoiceStore.getState();
    s().setSelectionMode(true);
    s().toggleSelected('a');
    s().setSelected(['a', 'b', 'c'], true);
    expect(s().selectedIds).toEqual(['a', 'b', 'c']);
    s().toggleSelected('b');
    s().setSelected(['a'], false);
    expect(s().selectedIds).toEqual(['c']);
  });

  it('forgets the ticks when the search changes or selection mode ends', () => {
    const s = () => useInvoiceStore.getState();
    s().setSelectionMode(true);
    s().setSelected(['a', 'b'], true);
    s().setSearch('maple');
    expect(s().selectedIds).toEqual([]);
    s().setSelected(['a'], true);
    s().setSelectionMode(false);
    expect(s().selectedIds).toEqual([]);
    expect(s().selectionMode).toBe(false);
  });
});

describe('InvoiceSelectionBar', () => {
  const props = () => ({ onClear: vi.fn(), onDownload: vi.fn(), onShare: vi.fn(), onDelete: vi.fn() });

  it('names what Download will produce', () => {
    expect(downloadLabel(1, ['pdf'])).toBe('Download PDF');
    expect(downloadLabel(1, ['excel'])).toBe('Download Excel');
    expect(downloadLabel(1, ['pdf', 'excel'])).toBe('Download ZIP');
    expect(downloadLabel(3, ['pdf'])).toBe('Download ZIP');
    expect(downloadLabel(3, [])).toBe('Choose a format');
  });

  it('shows the count and clears the selection', async () => {
    const p = props();
    render(<InvoiceSelectionBar count={3} {...p} />);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Clear/ }));
    expect(p.onClear).toHaveBeenCalled();
  });

  it('downloads the chosen formats', async () => {
    const p = props();
    render(<InvoiceSelectionBar count={3} {...p} />);
    await userEvent.click(screen.getByRole('button', { name: /^Download/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Excel files' }));
    await userEvent.click(screen.getByRole('button', { name: 'Download ZIP' }));
    expect(p.onDownload).toHaveBeenCalledWith(['pdf', 'excel']);
  });

  it('will not download without a format, or more invoices than a ZIP holds', async () => {
    const { unmount } = render(<InvoiceSelectionBar count={3} {...props()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Download/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'PDF files' }));
    expect(screen.getByRole('button', { name: 'Choose a format' })).toBeDisabled();
    unmount();
    render(<InvoiceSelectionBar count={51} {...props()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Download/ }));
    expect(screen.getByText(/holds up to 50/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download ZIP' })).toBeDisabled();
  });

  it('runs Share and Delete', async () => {
    const p = props();
    render(<InvoiceSelectionBar count={2} {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(p.onShare).toHaveBeenCalled();
    expect(p.onDelete).toHaveBeenCalled();
  });
});

describe('ShareInvoicesDialog', () => {
  let saved: HTMLAnchorElement[] = [];
  beforeEach(() => {
    saved = [];
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { saved.push(this); });
    vi.spyOn(invoiceService, 'getDocument').mockImplementation(async (id, kind) => ({ blob: new Blob(['x']), filename: `invoice-${id}.${kind === 'pdf' ? 'pdf' : 'xlsx'}` }));
    vi.spyOn(invoiceService, 'getZip').mockResolvedValue({ blob: new Blob(['zip']), filename: 'invoices-3.zip' });
    vi.spyOn(invoiceService, 'nativeShareStatus').mockResolvedValue({ available: false, copyFile: false });
  });
  afterEach(() => { vi.restoreAllMocks(); Object.assign(navigator, { share: undefined, canShare: undefined }); });

  const setup = (ids = ['a', 'b', 'c']) => {
    render(<ToastProvider><ShareInvoicesDialog ids={ids} onClose={vi.fn()} /></ToastProvider>);
    return userEvent.setup();
  };

  it('words the message for several invoices', () => {
    expect(bulkMessage(3).text).toBe('3 invoices\n\nHello,\n\nPlease find attached 3 invoices.\n\nThank you.');
  });

  it('prepares separate PDFs first and shares them all through the share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    const user = setup();
    expect(await screen.findByText(/3 files/)).toBeInTheDocument();
    expect(invoiceService.getDocument).toHaveBeenCalledTimes(3);
    await user.click(screen.getByRole('button', { name: /Share to an app/ }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const sent = share.mock.calls[0]![0] as ShareData;
    expect(sent.files).toHaveLength(3);
  });

  it('builds one ZIP when asked', async () => {
    const user = setup();
    await screen.findByText(/3 files/);
    await user.click(screen.getByRole('radio', { name: /One ZIP/ }));
    expect(await screen.findByText(/invoices-3\.zip/)).toBeInTheDocument();
    expect(invoiceService.getZip).toHaveBeenCalledWith(['a', 'b', 'c'], ['pdf']);
  });

  it('copies the ZIP to the clipboard when the browser will not share it', async () => {
    vi.spyOn(invoiceService, 'nativeShareStatus').mockResolvedValue({ available: true, copyFile: true });
    const copyZip = vi.spyOn(invoiceService, 'copyZip').mockResolvedValue({ filename: 'invoices-3.zip' });
    Object.assign(navigator, { share: vi.fn(), canShare: () => false });
    const user = setup();
    await user.click(screen.getByRole('radio', { name: /One ZIP/ }));
    await screen.findByText(/invoices-3\.zip/);
    await user.click(screen.getByRole('button', { name: /Share to an app/ }));
    await waitFor(() => expect(copyZip).toHaveBeenCalledWith(['a', 'b', 'c'], ['pdf'], expect.stringContaining('3 invoices')));
  });

  it('starts on a ZIP when there are too many invoices to send separately', async () => {
    setup(Array.from({ length: 12 }, (_, i) => `i${i}`));
    expect(await screen.findByText(/invoices-3\.zip/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Separate files/ })).toBeDisabled();
  });

  it('downloads every prepared file', async () => {
    const user = setup();
    await screen.findByText(/3 files/);
    await user.click(screen.getByRole('button', { name: /Download/ }));
    await waitFor(() => expect(saved.map((a) => a.download)).toEqual(['invoice-a.pdf', 'invoice-b.pdf', 'invoice-c.pdf']));
  });
});

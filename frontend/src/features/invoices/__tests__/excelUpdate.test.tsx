import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ExcelUpdatePreview, ExcelUpdateRecord } from 'shared';
import ExcelUpdateBanner from '../components/ExcelUpdateBanner';
import ExcelUpdateDialog from '../components/ExcelUpdateDialog';
import { excelUpdateService } from '../services/excelUpdateService';
import { renderRoutes } from '@/__tests__/utils';
import { ConfirmProvider } from '@/components/ui/confirm';

vi.mock('../services/excelUpdateService', () => ({ excelUpdateService: { preview: vi.fn(), apply: vi.fn(), latest: vi.fn(), undo: vi.fn() } }));
const service = vi.mocked(excelUpdateService);

const preview = (over: Partial<ExcelUpdatePreview> = {}): ExcelUpdatePreview => ({
  invoiceId: 'inv1', invoiceNumber: 'SAMPLE-3', currency: 'CAD', fileName: 'invoice.xlsx', invoiceVersion: '2026-10-20T10:00:00.000Z', fileIsOlder: false,
  lines: [
    { row: 20, status: 'changed', id: 'l1', input: { id: 'l1', descriptionOfGoods: 'Alphonso Mango', netWeightPerPackage: 10, numberOfBoxes: 120, ratePerKg: 1 }, totalNetWeight: 1200, totalPerBox: 10, amount: 1200, changes: [{ field: 'numberOfBoxes', label: 'Boxes', before: '100', after: '120' }], problems: [] },
    { row: 21, status: 'added', id: null, input: { descriptionOfGoods: 'Banana', netWeightPerPackage: 10, numberOfBoxes: 20, ratePerKg: 0.25 }, totalNetWeight: 200, totalPerBox: 2.5, amount: 50, changes: [], problems: [] },
  ],
  removed: [{ id: 'l3', descriptionOfGoods: 'Pomegranate', numberOfBoxes: 50, amount: 250 }],
  totals: { before: { boxes: 250, netWeight: 2500, subTotal: 2000, total: 2000 }, after: { boxes: 140, netWeight: 1400, subTotal: 1250, total: 1250 } },
  custom: null, payments: null, counts: { added: 1, removed: 1, changed: 1, unchanged: 0 }, warnings: [], blockers: [], canApply: true, ...over,
});

const render = (ui: React.ReactElement) => renderRoutes(<ConfirmProvider>{ui}</ConfirmProvider>);
const excel = () => new File(['x'], 'invoice.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

beforeEach(() => { vi.clearAllMocks(); });

describe('ExcelUpdateDialog', () => {
  it('shows what an edited file would change before anything is saved', async () => {
    service.preview.mockResolvedValue(preview());
    render(<ExcelUpdateDialog invoiceId="inv1" invoiceNumber="SAMPLE-3" onClose={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText('Choose the edited Excel'), excel());
    expect(await screen.findByText('Alphonso Mango')).toBeInTheDocument();
    expect(service.preview).toHaveBeenCalledWith('inv1', expect.any(File));
    const counts = within(screen.getByRole('dialog')).getAllByText(/^(Added|Changed|Removed|Same)$/);
    expect(counts.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/^Boxes:/)).toHaveTextContent('Boxes: 100 → 120');
    expect(screen.getByText('Pomegranate')).toBeInTheDocument();
    expect(screen.getByText('Invoice total').parentElement).toHaveTextContent(/2,000\.00.*1,250\.00/);
    expect(service.apply).not.toHaveBeenCalled();
  });

  it('applies the lines that were checked, against the version they were checked with', async () => {
    service.preview.mockResolvedValue(preview());
    service.apply.mockResolvedValue({ id: 'u1', fileName: 'invoice.xlsx', createdAt: '2026-10-21T00:00:00.000Z', added: 1, removed: 1, changed: 1, canUndo: true });
    const onClose = vi.fn();
    render(<ExcelUpdateDialog invoiceId="inv1" invoiceNumber="SAMPLE-3" onClose={onClose} />);
    await userEvent.upload(screen.getByLabelText('Choose the edited Excel'), excel());
    await userEvent.click(await screen.findByRole('button', { name: /Approve and update/ }));
    await waitFor(() => expect(service.apply).toHaveBeenCalledWith('inv1', {
      lines: [preview().lines[0]!.input, preview().lines[1]!.input], invoiceVersion: '2026-10-20T10:00:00.000Z', fileName: 'invoice.xlsx',
    }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('will not apply while a row has a problem, and says why', async () => {
    const bad = preview();
    bad.lines[1] = { ...bad.lines[1]!, problems: ['Boxes must be a whole number, 1 or more'] };
    service.preview.mockResolvedValue({ ...bad, canApply: false });
    render(<ExcelUpdateDialog invoiceId="inv1" invoiceNumber="SAMPLE-3" onClose={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText('Choose the edited Excel'), excel());
    expect(await screen.findByText('Boxes must be a whole number, 1 or more')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve and update/ })).toBeDisabled();
  });

  it('shows warnings, blockers and the effect on the balance of an actual invoice', async () => {
    service.preview.mockResolvedValue(preview({ warnings: ['This invoice was changed in the app after you downloaded this file.'], blockers: ['The total nett weight would be more than the gross weight.'], canApply: false, payments: { paid: 500, balanceBefore: 1500, balanceAfter: 750 } }));
    render(<ExcelUpdateDialog invoiceId="inv1" invoiceNumber="SAMPLE-3" onClose={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText('Choose the edited Excel'), excel());
    expect(await screen.findByText(/changed in the app after you downloaded/)).toBeInTheDocument();
    expect(screen.getByText(/more than the gross weight/)).toBeInTheDocument();
    expect(screen.getByText(/Balance due \(payments received/).parentElement).toHaveTextContent(/1,500\.00.*750\.00/);
    expect(screen.getByRole('button', { name: /Approve and update/ })).toBeDisabled();
  });

  it('says so when the file has no changes', async () => {
    service.preview.mockResolvedValue(preview({ lines: [{ ...preview().lines[0]!, status: 'unchanged', changes: [] }], removed: [], counts: { added: 0, removed: 0, changed: 0, unchanged: 1 }, canApply: false }));
    render(<ExcelUpdateDialog invoiceId="inv1" invoiceNumber="SAMPLE-3" onClose={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText('Choose the edited Excel'), excel());
    expect(await screen.findByText(/No changes found in this file/)).toBeInTheDocument();
  });

  it('shows the server\'s reason when a file cannot be used, and refuses a file that is not .xlsx', async () => {
    service.preview.mockRejectedValue(new Error('This file was downloaded from a different invoice.'));
    render(<ExcelUpdateDialog invoiceId="inv1" invoiceNumber="SAMPLE-3" onClose={vi.fn()} />);
    const input = screen.getByLabelText('Choose the edited Excel');
    await userEvent.upload(input, new File(['x'], 'notes.pdf', { type: 'application/pdf' }), { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveTextContent(/\.xlsx/);
    expect(service.preview).not.toHaveBeenCalled();
    await userEvent.upload(input, excel());
    expect(await screen.findByText(/downloaded from a different invoice/)).toBeInTheDocument();
  });
});

describe('ExcelUpdateDialog: an invoice with a Party page and a Custom page', () => {
  const customPage = () => ({
    lines: [{ row: 12, status: 'changed' as const, id: 'c2', input: { id: 'c2', descriptionOfGoods: 'Kesar Mango', netWeightPerPackage: 10, numberOfBoxes: 100, ratePerKg: 0.35 }, totalNetWeight: 1000, totalPerBox: 3.5, amount: 350, changes: [{ field: 'ratePerKg' as const, label: 'Rate / kg', before: '0.3', after: '0.35' }], problems: [] }],
    removed: [{ id: 'c1', descriptionOfGoods: 'Custom Alphonso', numberOfBoxes: 100, amount: 400 }],
    totals: { before: { boxes: 200, netWeight: 2000, subTotal: 700, total: 700 }, after: { boxes: 100, netWeight: 1000, subTotal: 350, total: 350 } },
    counts: { added: 0, removed: 1, changed: 1, unchanged: 0 },
  });

  it('has a tab for each page, and shows the Custom page\'s own changes and totals', async () => {
    service.preview.mockResolvedValue(preview({ custom: customPage() }));
    render(<ExcelUpdateDialog invoiceId="inv1" invoiceNumber="RG-1" onClose={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText('Choose the edited Excel'), excel());
    expect(await screen.findByText('Alphonso Mango')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Party page/ })).toHaveTextContent('3 changes');
    expect(screen.getByRole('tab', { name: /Custom page/ })).toHaveTextContent('2 changes');
    await userEvent.click(screen.getByRole('tab', { name: /Custom page/ }));
    expect(screen.getByText('Kesar Mango')).toBeInTheDocument();
    expect(screen.getByText('Custom Alphonso')).toBeInTheDocument();
    expect(screen.queryByText('Alphonso Mango')).not.toBeInTheDocument();
    expect(screen.getByText('Invoice total').parentElement).toHaveTextContent(/700\.00.*350\.00/);
  });

  it('sends both pages\' lines when approved', async () => {
    service.preview.mockResolvedValue(preview({ custom: customPage() }));
    service.apply.mockResolvedValue({ id: 'u1', fileName: 'invoice.xlsx', createdAt: '2026-10-21T00:00:00.000Z', added: 1, removed: 2, changed: 2, canUndo: true });
    render(<ExcelUpdateDialog invoiceId="inv1" invoiceNumber="RG-1" onClose={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText('Choose the edited Excel'), excel());
    await userEvent.click(await screen.findByRole('button', { name: /Approve and update/ }));
    await waitFor(() => expect(service.apply).toHaveBeenCalledWith('inv1', expect.objectContaining({
      lines: [preview().lines[0]!.input, preview().lines[1]!.input], customLines: [customPage().lines[0]!.input], invoiceVersion: '2026-10-20T10:00:00.000Z',
    })));
  });

  it('shows no tabs for an ordinary invoice', async () => {
    service.preview.mockResolvedValue(preview());
    render(<ExcelUpdateDialog invoiceId="inv1" invoiceNumber="SAMPLE-3" onClose={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText('Choose the edited Excel'), excel());
    await screen.findByText('Alphonso Mango');
    expect(screen.queryByRole('tab', { name: /Custom page/ })).not.toBeInTheDocument();
    expect(service.apply).not.toHaveBeenCalled();
  });
});

describe('ExcelUpdateBanner', () => {
  const record = (over: Partial<ExcelUpdateRecord> = {}): ExcelUpdateRecord => ({ id: 'u1', fileName: 'invoice.xlsx', createdAt: '2026-10-21T00:00:00.000Z', added: 1, removed: 2, changed: 3, canUndo: true, ...over });

  it('offers Undo while the update can still be undone, and undoes it after asking', async () => {
    service.latest.mockResolvedValue(record());
    service.undo.mockResolvedValue(undefined);
    render(<ExcelUpdateBanner invoiceId="inv1" />);
    expect(await screen.findByText(/updated from Excel/)).toHaveTextContent(/1 added, 3 changed, 2 removed/);
    await userEvent.click(screen.getByRole('button', { name: /Undo/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Undo update' }));
    await waitFor(() => expect(service.undo).toHaveBeenCalledWith('inv1'));
  });

  it('shows nothing when there is no update, or it can no longer be undone', async () => {
    service.latest.mockResolvedValue(record({ canUndo: false }));
    const { container } = render(<ExcelUpdateBanner invoiceId="inv1" />);
    await waitFor(() => expect(service.latest).toHaveBeenCalled());
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});

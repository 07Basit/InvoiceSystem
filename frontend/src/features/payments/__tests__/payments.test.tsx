import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InvoicePayments, Statement } from 'shared';
import PaymentsSection from '../components/PaymentsSection';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import StatementDialog from '../components/StatementDialog';
import { paymentService } from '../services/paymentService';
import { renderRoutes } from '@/__tests__/utils';
import { ConfirmProvider } from '@/components/ui/confirm';

vi.mock('../services/paymentService', () => ({
  paymentService: { methods: vi.fn(), forInvoice: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), statement: vi.fn(), downloadStatementPdf: vi.fn(), downloadStatementExcel: vi.fn() },
}));
const service = vi.mocked(paymentService);

const position = (over: Partial<InvoicePayments> = {}): InvoicePayments => ({
  invoiceId: 'inv1', currency: 'CAD',
  payments: [{ id: 'p1', invoiceId: 'inv1', paidOn: '2026-10-20', amount: 400, method: 'Bank transfer', reference: 'UTR123', notes: 'part payment', createdAt: '2026-10-20T10:00:00.000Z' }],
  summary: { total: 1000, paid: 400, balance: 600, status: 'partial' }, ...over,
});

const render = (ui: React.ReactElement) => renderRoutes(<ConfirmProvider>{ui}</ConfirmProvider>);

beforeEach(() => { vi.clearAllMocks(); service.forInvoice.mockResolvedValue(position()); service.methods.mockResolvedValue([]); });

describe('PaymentStatusBadge', () => {
  it('names each status', () => {
    const { rerender } = render(<PaymentStatusBadge summary={{ status: 'unpaid' }} />);
    expect(screen.getByText('Unpaid')).toBeInTheDocument();
    rerender(<ConfirmProvider><PaymentStatusBadge summary={{ status: 'overpaid' }} /></ConfirmProvider>);
    expect(screen.getByText('Overpaid')).toBeInTheDocument();
  });
});

describe('PaymentsSection', () => {
  it('shows the total, what was received, the balance due and each payment', async () => {
    render(<PaymentsSection invoiceId="inv1" />);
    expect(await screen.findByText('UTR123')).toBeInTheDocument();
    expect(screen.getByText('Part paid')).toBeInTheDocument();
    expect(screen.getByText('Balance due').closest('div')).toHaveTextContent(/600\.00/);
    expect(screen.getByText('Received').closest('div')).toHaveTextContent(/400\.00/);
    expect(screen.getByText('Bank transfer')).toBeInTheDocument();
  });

  it('has a Statement button that opens the importer\'s statement', async () => {
    service.statement.mockResolvedValue({ importer: { id: 'imp1', name: 'KJ Fruits', address: null, contact: null, email: null }, from: null, to: null, generatedOn: '2026-11-16', sections: [] });
    render(<PaymentsSection invoiceId="inv1" importer={{ id: 'imp1', name: 'KJ Fruits' }} />);
    await userEvent.click(await screen.findByRole('button', { name: /Statement/ }));
    expect(await screen.findByRole('dialog', { name: 'Statement of account' })).toHaveTextContent('KJ Fruits');
    expect(service.statement).toHaveBeenCalledWith('imp1', {});
  });

  it('invites the first payment when there is none', async () => {
    service.forInvoice.mockResolvedValue(position({ payments: [], summary: { total: 1000, paid: 0, balance: 1000, status: 'unpaid' } }));
    render(<PaymentsSection invoiceId="inv1" />);
    expect(await screen.findByText(/No payment has been recorded/)).toBeInTheDocument();
    expect(screen.getByText('Unpaid')).toBeInTheDocument();
  });

  it('records a payment, starting from the balance due', async () => {
    service.create.mockResolvedValue(position({ summary: { total: 1000, paid: 1000, balance: 0, status: 'paid' } }));
    render(<PaymentsSection invoiceId="inv1" />);
    await userEvent.click(await screen.findByRole('button', { name: /Record payment/ }));
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    expect(within(dialog).getByLabelText('Amount')).toHaveValue('600');
    expect(within(dialog).getByText(/settles the invoice in full/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Reference number'), 'TXN-9');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(service.create).toHaveBeenCalledWith('inv1', expect.objectContaining({ amount: 600, method: 'Bank transfer', reference: 'TXN-9', paidOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })));
  });

  it('starts on Bank transfer, offers methods typed before once, and has no "Other"', async () => {
    service.methods.mockResolvedValue(['Wire (HSBC)', 'cheque']);
    render(<PaymentsSection invoiceId="inv1" />);
    await userEvent.click(await screen.findByRole('button', { name: /Record payment/ }));
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    const box = within(dialog).getByRole('combobox', { name: 'Payment method' });
    expect(box).toHaveTextContent('Bank transfer');
    await userEvent.click(box);
    expect(await screen.findByText('Wire (HSBC)')).toBeInTheDocument();
    expect(screen.getAllByText(/^cheque$/i)).toHaveLength(1);
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  it('picks the payment method from the dropdown, and also accepts one that is not listed', async () => {
    service.create.mockResolvedValue(position());
    render(<PaymentsSection invoiceId="inv1" />);
    await userEvent.click(await screen.findByRole('button', { name: /Record payment/ }));
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Payment method' }));
    await userEvent.click(await screen.findByText('Cheque'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(service.create).toHaveBeenCalledWith('inv1', expect.objectContaining({ method: 'Cheque' })));
  });

  it('warns when the payment is more than what is due, and refuses an empty amount', async () => {
    render(<PaymentsSection invoiceId="inv1" />);
    await userEvent.click(await screen.findByRole('button', { name: /Record payment/ }));
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    const amount = within(dialog).getByLabelText('Amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '700');
    expect(within(dialog).getByText(/more than the balance due/)).toBeInTheDocument();
    await userEvent.clear(amount);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Amount is required|Amount must be/);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('deletes a payment after asking', async () => {
    service.remove.mockResolvedValue(position({ payments: [], summary: { total: 1000, paid: 0, balance: 1000, status: 'unpaid' } }));
    render(<PaymentsSection invoiceId="inv1" />);
    await userEvent.click(await screen.findByRole('button', { name: /Delete payment of/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(service.remove).toHaveBeenCalledWith('p1'));
  });
});

describe('StatementDialog', () => {
  const statement: Statement = {
    importer: { id: 'imp1', name: 'KJ Fruits', address: null, contact: null, email: null }, from: null, to: null, generatedOn: '2026-11-16',
    sections: [{ currency: 'CAD', opening: 0, invoiced: 1500, received: 400, closing: 1100, rows: [], invoices: [] }],
  };

  it('previews where the account stands and downloads it as a PDF or Excel file', async () => {
    service.statement.mockResolvedValue(statement);
    service.downloadStatementPdf.mockResolvedValue(undefined);
    service.downloadStatementExcel.mockResolvedValue(undefined);
    render(<StatementDialog importerId="imp1" importerName="KJ Fruits" onClose={vi.fn()} />);
    expect(await screen.findByText('Account in CAD')).toBeInTheDocument();
    expect(screen.getByText('Balance due').closest('dl')).toHaveTextContent(/1,100\.00/);
    await userEvent.click(screen.getByRole('button', { name: /Download PDF/ }));
    await waitFor(() => expect(service.downloadStatementPdf).toHaveBeenCalledWith('imp1', {}));
    await userEvent.click(screen.getByRole('button', { name: /Download Excel/ }));
    await waitFor(() => expect(service.downloadStatementExcel).toHaveBeenCalledWith('imp1', {}));
  });

  it('narrows the statement to a period', async () => {
    service.statement.mockResolvedValue(statement);
    render(<StatementDialog importerId="imp1" importerName="KJ Fruits" onClose={vi.fn()} />);
    await screen.findByText('Account in CAD');
    await userEvent.click(screen.getByRole('button', { name: 'This year' }));
    await waitFor(() => expect(service.statement).toHaveBeenLastCalledWith('imp1', expect.objectContaining({ from: expect.stringMatching(/-01-01$/), to: expect.stringMatching(/-12-31$/) })));
  });

  it('says so when there is nothing to show', async () => {
    service.statement.mockResolvedValue({ ...statement, sections: [] });
    render(<StatementDialog importerId="imp1" importerName="KJ Fruits" onClose={vi.fn()} />);
    expect(await screen.findByText(/No actual invoices or payments/)).toBeInTheDocument();
  });
});

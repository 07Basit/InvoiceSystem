import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoiceCard from '../components/InvoiceCard';
import type { InvoiceListItem } from '../services/invoiceService';

const invoice = {
  id: 'inv1', invoiceNumber: 'INV-2026-001', invoiceDate: '2026-09-15T00:00:00.000Z', createdAt: '2026-09-15T00:00:00.000Z', updatedAt: '2026-09-15T00:00:00.000Z',
  importerId: 'imp1', importer: { id: 'imp1', name: 'North Maple Foods', currency: 'CAD' }, buyerName: 'Jane Doe',
  portOfLoading: 'BOM', portOfDischarge: 'YUL', finalDestination: 'YYZ', countryOfDestination: 'Canada',
  currency: 'CAD', total: 1500, subTotal: 1500, roundOff: 0, totalBoxes: 1, totalNetWeight: 10, excludedFromRevenue: false,
} as unknown as InvoiceListItem;

const setup = (over: Partial<InvoiceListItem> = {}) => {
  const handlers = { onOpen: vi.fn(), onPdf: vi.fn(), onExcel: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  render(<InvoiceCard invoice={{ ...invoice, ...over }} {...handlers} />);
  return { handlers, user: userEvent.setup() };
};

describe('InvoiceCard', () => {
  it('shows the number, importer, buyer, route, amount and package summary', () => {
    setup();
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    expect(screen.getByText('North Maple Foods')).toBeInTheDocument();
    expect(screen.getByText('Buyer: Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('BOM')).toBeInTheDocument();
    expect(screen.getByText('YUL')).toBeInTheDocument();
    expect(screen.getByText('YYZ')).toBeInTheDocument();
    expect(screen.getByText('CA$1,500.00')).toBeInTheDocument();
    expect(screen.getByText(/1 box · 10 kg/)).toBeInTheDocument();
  });

  it('labels every action with a hover tooltip', () => {
    setup();
    const tips = screen.getAllByRole('tooltip').map((t) => t.textContent);
    expect(tips).toEqual(['View details', 'Download PDF', 'Download Excel', 'Edit invoice', 'Delete invoice']);
  });

  it('opens on card click, but each action only runs its own handler', async () => {
    const { handlers, user } = setup();
    await user.click(screen.getByText('INV-2026-001'));
    expect(handlers.onOpen).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    await user.click(screen.getByRole('button', { name: 'Download Excel' }));
    await user.click(screen.getByRole('button', { name: 'Edit invoice' }));
    await user.click(screen.getByRole('button', { name: 'Delete invoice' }));
    expect(handlers.onPdf).toHaveBeenCalledTimes(1);
    expect(handlers.onExcel).toHaveBeenCalledTimes(1);
    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
    expect(handlers.onOpen).toHaveBeenCalledTimes(1); // action clicks must not also open the invoice
  });

  it('flags an invoice that has no exchange rate', () => {
    setup({ excludedFromRevenue: true });
    expect(screen.getByText('Not in revenue')).toBeInTheDocument();
  });
});

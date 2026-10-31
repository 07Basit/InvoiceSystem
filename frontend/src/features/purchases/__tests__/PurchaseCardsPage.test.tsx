import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PurchaseCardsPage from '../pages/PurchaseCardsPage';
import PurchaseFilterPanel from '../components/PurchaseFilterPanel';
import { supplierService, type Supplier } from '../services/purchaseService';
import { noPurchaseFilters } from '../utils/purchaseFilters';
import { renderRoutes } from '@/__tests__/utils';

vi.mock('../services/purchaseService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/purchaseService')>()),
  supplierService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
}));
const suppliers = vi.mocked(supplierService);

const supplier = (over: Partial<Supplier>): Supplier => ({
  id: 's1', name: 'Mapoose', contact: null, phone: null, email: null, address: null, gstin: null, importTemplate: null, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', _count: { purchases: 0 }, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  suppliers.list.mockResolvedValue([supplier({ _count: { purchases: 3 } }), supplier({ id: 's2', name: 'Sunil', _count: { purchases: 1 } })]);
});

describe('PurchaseCardsPage', () => {
  it('shows a card for all purchase invoices and one for each supplier, with their counts', async () => {
    renderRoutes(<PurchaseCardsPage />, { route: '/purchases', path: '/purchases' });
    expect(await screen.findByRole('button', { name: 'All Purchase Invoices, Every supplier, 4 invoices' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mapoose Purchase Invoices, Supplier, 3 invoices' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sunil Purchase Invoices, Supplier, 1 invoice' })).toBeInTheDocument();
  });

  it('adds a supplier from the dashed card', async () => {
    suppliers.create.mockResolvedValue(supplier({ id: 's3', name: 'Vinod' }));
    renderRoutes(<PurchaseCardsPage />, { route: '/purchases', path: '/purchases' });
    await userEvent.click(await screen.findByRole('button', { name: /New supplier/ }));
    await userEvent.type(screen.getByLabelText('Supplier name'), 'vinod');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add supplier' }));
    expect(suppliers.create).toHaveBeenCalledWith({ name: 'Vinod' });
  });
});

describe('PurchaseFilterPanel', () => {
  it('applies a quick date range and clears everything', async () => {
    const onChange = vi.fn();
    renderRoutes(
      <PurchaseFilterPanel open onClose={() => undefined} filters={{ ...noPurchaseFilters, product: 'Amla' }} onChange={onChange} suppliers={[supplier({})]} show={{ basis: true, product: true, supplier: true }} matching={2} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Last 30 days' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ product: 'Amla', dateFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenLastCalledWith(noPurchaseFilters);
    expect(screen.getByRole('button', { name: 'Show 2 invoices' })).toBeInTheDocument();
  });
});

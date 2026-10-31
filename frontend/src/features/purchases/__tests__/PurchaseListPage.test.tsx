import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PurchaseListPage from '../pages/PurchaseListPage';
import { purchaseService, supplierService, type Supplier } from '../services/purchaseService';
import { renderRoutes } from '@/__tests__/utils';
import { ConfirmProvider } from '@/components/ui/confirm';

vi.mock('../services/purchaseService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/purchaseService')>()),
  supplierService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
  purchaseService: { list: vi.fn() },
}));
const suppliers = vi.mocked(supplierService);
const purchases = vi.mocked(purchaseService);

const supplier = (over: Partial<Supplier>): Supplier => ({
  id: 's1', name: 'Sunil', contact: null, phone: null, email: null, address: null, gstin: null, importTemplate: null, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', _count: { purchases: 0 }, ...over,
});
const render = (id: string) => renderRoutes(<ConfirmProvider><PurchaseListPage /></ConfirmProvider>, { route: `/purchases/list/${id}`, path: '/purchases/list/:supplier' });

beforeEach(() => {
  vi.clearAllMocks();
  purchases.list.mockResolvedValue({ rows: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } } as never);
});

describe('PurchaseListPage: deleting a supplier', () => {
  it('deletes a supplier that has no invoices, after asking', async () => {
    suppliers.list.mockResolvedValue([supplier({})]);
    suppliers.remove.mockResolvedValue(undefined as never);
    render('s1');
    await userEvent.click(await screen.findByRole('button', { name: /Delete supplier/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(suppliers.remove).toHaveBeenCalledWith('s1'));
  });

  it('does not allow deleting a supplier that still has invoices', async () => {
    suppliers.list.mockResolvedValue([supplier({ _count: { purchases: 2 } })]);
    render('s1');
    expect(await screen.findByRole('button', { name: /Delete supplier/ })).toBeDisabled();
  });

  it('offers no delete on the all-invoices list', async () => {
    suppliers.list.mockResolvedValue([supplier({})]);
    render('all');
    await screen.findByRole('heading', { name: 'All Purchase Invoices' });
    expect(screen.queryByRole('button', { name: /Delete supplier/ })).not.toBeInTheDocument();
  });
});

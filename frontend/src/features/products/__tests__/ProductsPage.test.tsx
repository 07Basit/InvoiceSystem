import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductsPage from '../pages/ProductsPage';
import ProductListPage from '../pages/ProductListPage';
import { productService, type Product } from '@/features/invoices/services/productService';
import { productListService, type ProductList } from '@/features/invoices/services/productListService';
import { clientService } from '@/features/clients/services/clientService';
import { renderRoutes } from '@/__tests__/utils';

vi.mock('@/features/invoices/services/productService', () => ({
  productService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/features/invoices/services/productListService', () => ({
  productListService: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/features/clients/services/clientService', () => ({
  clientService: { getAll: vi.fn() },
}));
const products = vi.mocked(productService);
const lists = vi.mocked(productListService);

const product = (over: Partial<Product>): Product => ({
  id: 'p1', name: 'Alphonso Mango', importerId: null, currency: null, locationName: null, nettWeightPerPackage: null, ratePerKg: null, hsCode: null, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const list = (over: Partial<ProductList> = {}): ProductList => ({ id: 'l1', importerId: 'i1', currency: 'CAD', locationName: null, createdAt: '2026-01-01T00:00:00.000Z', ...over });

const importer = { id: 'i1', name: 'KJ Fruits', currency: 'CAD', isActive: true, landingLocations: [{ id: 'x1', name: 'Toronto', portOfDischarge: 'YYZ' }, { id: 'x2', name: 'Montreal', portOfDischarge: 'YUL' }] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(clientService.getAll).mockResolvedValue({ success: true, data: [importer], error: null, meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false } } as never);
  products.list.mockResolvedValue({
    success: true, error: null, meta: null,
    data: [
      product({}),
      product({ id: 'p2', name: 'Banana', importerId: 'i1', currency: 'CAD' }),
      product({ id: 'p3', name: 'Papaya', importerId: 'i1', currency: 'CAD', locationName: 'Toronto' }),
      product({ id: 'p4', name: 'Fig', importerId: 'i1', currency: 'CAD', locationName: 'Toronto' }),
    ],
  });
  lists.list.mockResolvedValue({ success: true, error: null, meta: null, data: [list(), list({ id: 'l2', locationName: 'Toronto' })] });
});

const overview = () => renderRoutes(<ProductsPage />, { route: '/products', path: '/products' });

describe('ProductsPage (the cards)', () => {
  it('shows the general list card and a card for each importer list, with product counts', async () => {
    overview();
    expect(await screen.findByRole('button', { name: 'KJ Fruits, CAD · Toronto, 2 products' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'General list, Offered on every invoice, 1 product' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KJ Fruits, CAD · All locations, 1 product' })).toBeInTheDocument();
  });

  it('opens a list in detail when its card is clicked', async () => {
    const user = userEvent.setup();
    overview();
    await user.click(await screen.findByRole('button', { name: /KJ Fruits, CAD · Toronto/ }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/products/l2');
  });

  it('opens the general list the same way', async () => {
    const user = userEvent.setup();
    overview();
    await user.click(await screen.findByRole('button', { name: /^General list/ }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/products/general');
  });

  it('invites you to create the first list when there are none', async () => {
    lists.list.mockResolvedValue({ success: true, error: null, meta: null, data: [] });
    overview();
    expect(await screen.findByText(/No importer lists yet/)).toBeInTheDocument();
  });

  it('creates a list from an importer, a currency and a location, then opens it', async () => {
    lists.create.mockResolvedValue({ success: true, error: null, meta: null, data: list({ id: 'l9', locationName: 'Montreal' }) });
    const user = userEvent.setup();
    overview();
    await user.click(await screen.findByRole('button', { name: /^Create list/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a product list' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Importer' }));
    await user.click(await screen.findByRole('option', { name: /KJ Fruits/ }));
    expect(within(dialog).getByRole('combobox', { name: 'Currency' })).toHaveTextContent('CAD');
    await user.click(within(dialog).getByRole('combobox', { name: 'Location' }));
    await user.click(await screen.findByRole('option', { name: 'Montreal' }));
    await user.click(within(dialog).getByRole('button', { name: /Create list/ }));
    await waitFor(() => expect(lists.create).toHaveBeenCalledWith({ importerId: 'i1', currency: 'CAD', locationName: 'Montreal' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/products/l9');
  });

  it('needs an importer and a currency', async () => {
    const user = userEvent.setup();
    overview();
    await user.click(await screen.findByRole('button', { name: /^Create list/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a product list' });
    await user.click(within(dialog).getByRole('button', { name: /Create list/ }));
    expect(await within(dialog).findByText('Choose an importer')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a currency')).toBeInTheDocument();
    expect(lists.create).not.toHaveBeenCalled();
  });

  it('opens the existing list instead of creating the same one twice', async () => {
    const user = userEvent.setup();
    overview();
    await user.click(await screen.findByRole('button', { name: /^Create list/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a product list' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Importer' }));
    await user.click(await screen.findByRole('option', { name: /KJ Fruits/ }));
    await user.click(within(dialog).getByRole('button', { name: /Create list/ }));
    expect(lists.create).not.toHaveBeenCalled();
    expect(await screen.findByTestId('location')).toHaveTextContent('/products/l1');
  });
});

const detail = (listId: string) => renderRoutes(<ProductListPage />, { route: `/products/${listId}`, path: '/products/:listId' });

describe('ProductListPage (the detail view)', () => {
  it('shows one list with its own products only', async () => {
    detail('l2');
    expect(await screen.findByRole('heading', { name: 'KJ Fruits', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('CAD · Toronto')).toBeInTheDocument();
    expect(await screen.findByText('Papaya')).toBeInTheDocument();
    expect(screen.getByText('Fig')).toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    expect(screen.queryByText('Alphonso Mango')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Products/ })).toHaveAttribute('href', '/products');
  });

  it('shows the general list, which cannot be deleted', async () => {
    detail('general');
    expect(await screen.findByRole('heading', { name: 'General list', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Alphonso Mango')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete list/ })).not.toBeInTheDocument();
  });

  it('adds a product to this list, picked from the general list', async () => {
    products.create.mockResolvedValue({ success: true, data: product({ id: 'n1', name: 'Alphonso Mango' }), error: null, meta: null });
    const user = userEvent.setup();
    detail('l2');
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    await user.click(screen.getByRole('combobox', { name: 'Product name' }));
    await user.click(await screen.findByRole('option', { name: /Alphonso Mango/ }));
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    await waitFor(() => expect(products.create).toHaveBeenCalledWith({ importerId: 'i1', currency: 'CAD', locationName: 'Toronto', name: 'Alphonso Mango' }));
  });

  it('deletes the list after asking, then goes back', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true);
    lists.remove.mockResolvedValue({ success: true, data: null, error: null, meta: null });
    const user = userEvent.setup();
    detail('l2');
    await user.click(await screen.findByRole('button', { name: /Delete list/ }));
    expect(ask).toHaveBeenCalledWith(expect.stringContaining('Its 2 products will be deleted too'));
    await waitFor(() => expect(lists.remove).toHaveBeenCalledWith('l2'));
    expect(await screen.findByTestId('location')).toHaveTextContent('/products');
  });

  it('keeps the list when you say no', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    detail('l2');
    await user.click(await screen.findByRole('button', { name: /Delete list/ }));
    expect(lists.remove).not.toHaveBeenCalled();
  });

  it('says when a list is not found', async () => {
    detail('gone');
    expect(await screen.findByText(/This list was not found/)).toBeInTheDocument();
  });
});

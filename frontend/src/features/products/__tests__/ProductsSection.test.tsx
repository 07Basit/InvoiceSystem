import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductsSection from '../components/ProductsSection';
import { productService, type Product } from '@/features/invoices/services/productService';
import { renderRoutes } from '@/__tests__/utils';

vi.mock('@/features/invoices/services/productService', () => ({
  productService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
}));
const products = vi.mocked(productService);

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'Alphonso Mango', importerId: null, currency: null, locationName: null, nettWeightPerPackage: null, ratePerKg: null, hsCode: null, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const listOf = (...data: Product[]) => ({ success: true as const, data, error: null, meta: null });
const one = (data: Product) => ({ success: true as const, data, error: null, meta: null });

const render = () => renderRoutes(<ProductsSection />, { route: '/products', path: '/products' });

beforeEach(() => {
  vi.clearAllMocks();
  products.list.mockResolvedValue(listOf());
});

describe('ProductsSection', () => {
  it('invites you to add the first product', async () => {
    render();
    expect(await screen.findByText('No products here yet')).toBeInTheDocument();
  });

  it('lists products with their usual weight and rate', async () => {
    products.list.mockResolvedValue(listOf(product({ nettWeightPerPackage: '10.000', ratePerKg: '6.5000', hsCode: '0804' })));
    render();
    expect(await screen.findByText('Alphonso Mango')).toBeInTheDocument();
    expect(screen.getByText('10 kg · 6.5 per kg · HS 0804')).toBeInTheDocument();
  });

  it('adds a product with a name only', async () => {
    products.create.mockResolvedValue(one(product({ name: 'Banana' })));
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    await user.type(screen.getByLabelText('Product name'), 'Banana');
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    await waitFor(() => expect(products.create).toHaveBeenCalledWith({ name: 'Banana' }));
  });

  it('sends the usual weight and rate as numbers', async () => {
    products.create.mockResolvedValue(one(product()));
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    await user.type(screen.getByLabelText('Product name'), 'Papaya');
    await user.type(screen.getByLabelText(/Usual nett weight/), '12');
    await user.type(screen.getByLabelText(/Usual rate/), '2.5');
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    await waitFor(() => expect(products.create).toHaveBeenCalledWith({ name: 'Papaya', nettWeightPerPackage: 12, ratePerKg: 2.5 }));
  });

  it('asks for a name and refuses a zero rate', async () => {
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    await user.type(screen.getByLabelText(/Usual rate/), '0');
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    expect(await screen.findByText('Product name is required')).toBeInTheDocument();
    expect(screen.getByText('Rate per kg must be above 0')).toBeInTheDocument();
    expect(products.create).not.toHaveBeenCalled();
  });

  it('marks a product as not needed', async () => {
    products.list.mockResolvedValue(listOf(product()));
    products.setActive.mockResolvedValue(one(product({ isActive: false })));
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole('button', { name: 'Mark Alphonso Mango as not needed' }));
    await waitFor(() => expect(products.setActive).toHaveBeenCalledWith('p1', false));
  });
});

describe('ProductsSection lists', () => {
  const mine = product({ id: 'p2', name: 'Banana', importerId: 'i1', currency: 'CAD', locationName: null });
  const mineToronto = product({ id: 'p3', name: 'Papaya', importerId: 'i1', currency: 'CAD', locationName: 'Toronto' });

  it('shows only the products of the list it is given', async () => {
    products.list.mockResolvedValue(listOf(product(), mine, mineToronto));
    const { unmount } = renderRoutes(<ProductsSection />, { route: '/products', path: '/products' });
    expect(await screen.findByText('Alphonso Mango')).toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    unmount();
    renderRoutes(<ProductsSection scope={{ importerId: 'i1', currency: 'CAD' }} scopeLabel="KJ · CAD" />, { route: '/products', path: '/products' });
    expect(await screen.findByText('Banana')).toBeInTheDocument();
    expect(screen.queryByText('Papaya')).not.toBeInTheDocument();
    expect(screen.queryByText('Alphonso Mango')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'KJ · CAD' })).toBeInTheDocument();
  });

  it('picks the name from the general list when adding to an importer list, bringing its usual values', async () => {
    products.list.mockResolvedValue(listOf(product({ id: 'g1', name: 'Papaya', nettWeightPerPackage: '12', ratePerKg: '2.5', hsCode: '0807' }), product({ id: 'g2', name: 'Guava' })));
    products.create.mockResolvedValue(one(mineToronto));
    const user = userEvent.setup();
    renderRoutes(<ProductsSection scope={{ importerId: 'i1', currency: 'CAD', locationName: 'Toronto' }} />, { route: '/products', path: '/products' });
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    expect(screen.queryByRole('textbox', { name: 'Product name' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Product name' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent?.split(/\d/)[0])).toEqual(['Guava', 'Papaya']);
    await user.click(await screen.findByRole('option', { name: /Papaya/ }));
    expect(screen.getByLabelText(/Usual nett weight/)).toHaveValue('12');
    expect(screen.getByLabelText(/Usual rate/)).toHaveValue('2.5');
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    await waitFor(() => expect(products.create).toHaveBeenCalledWith({ importerId: 'i1', currency: 'CAD', locationName: 'Toronto', name: 'Papaya', nettWeightPerPackage: 12, ratePerKg: 2.5, hsCode: '0807' }));
  });

  it('does not offer a general product that is already in the importer list', async () => {
    products.list.mockResolvedValue(listOf(product({ id: 'g1', name: 'Papaya' }), product({ id: 'g2', name: 'Guava' }), mineToronto));
    const user = userEvent.setup();
    renderRoutes(<ProductsSection scope={{ importerId: 'i1', currency: 'CAD', locationName: 'Toronto' }} />, { route: '/products', path: '/products' });
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    await user.click(screen.getByRole('combobox', { name: 'Product name' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Guava']);
  });

  it('asks you to choose a product before saving', async () => {
    products.list.mockResolvedValue(listOf(product({ id: 'g1', name: 'Papaya' })));
    const user = userEvent.setup();
    renderRoutes(<ProductsSection scope={{ importerId: 'i1', currency: 'CAD' }} />, { route: '/products', path: '/products' });
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    expect(await screen.findByText('Product name is required')).toBeInTheDocument();
    expect(products.create).not.toHaveBeenCalled();
  });

  it('still types the name freely in the general list', async () => {
    products.create.mockResolvedValue(one(product({ id: 'n', name: 'Guava' })));
    const user = userEvent.setup();
    renderRoutes(<ProductsSection />, { route: '/products', path: '/products' });
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    await user.type(screen.getByRole('textbox', { name: 'Product name' }), 'Guava');
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    await waitFor(() => expect(products.create).toHaveBeenCalledWith({ name: 'Guava' }));
  });

  it('keeps an edited product in its own list', async () => {
    products.list.mockResolvedValue(listOf(mine));
    products.update.mockResolvedValue(one(mine));
    const user = userEvent.setup();
    renderRoutes(<ProductsSection scope={{ importerId: 'i1', currency: 'CAD' }} />, { route: '/products', path: '/products' });
    await user.click(await screen.findByRole('button', { name: 'Edit Banana' }));
    await user.type(screen.getByLabelText(/Usual rate/), '2.5');
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    await waitFor(() => expect(products.update).toHaveBeenCalledWith('p2', { importerId: 'i1', currency: 'CAD', name: 'Banana', ratePerKg: 2.5 }));
  });
});

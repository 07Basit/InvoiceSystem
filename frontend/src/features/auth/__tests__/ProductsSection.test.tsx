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
  id: 'p1', name: 'Alphonso Mango', nettWeightPerPackage: null, ratePerKg: null, hsCode: null, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const listOf = (...data: Product[]) => ({ success: true as const, data, error: null, meta: null });
const one = (data: Product) => ({ success: true as const, data, error: null, meta: null });

const render = () => renderRoutes(<ProductsSection />, { route: '/profile', path: '/profile' });

beforeEach(() => {
  vi.clearAllMocks();
  products.list.mockResolvedValue(listOf());
});

describe('ProductsSection', () => {
  it('invites you to add the first product', async () => {
    render();
    expect(await screen.findByText('No products yet')).toBeInTheDocument();
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

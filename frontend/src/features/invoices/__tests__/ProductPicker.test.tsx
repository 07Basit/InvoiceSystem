import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductPicker from '../components/ProductPicker';
import { productService, type Product } from '../services/productService';
import { renderRoutes } from '@/__tests__/utils';

vi.mock('../services/productService', () => ({
  productService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
}));
const products = vi.mocked(productService);

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'Alphonso Mango', nettWeightPerPackage: '10', ratePerKg: '6.5', hsCode: null, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});

function setup(value = '') {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  renderRoutes(<ProductPicker value={value} onSelect={onSelect} ariaLabel="Description of goods for product 1" />, { route: '/x', path: '/x' });
  return { onSelect, user };
}

beforeEach(() => {
  vi.clearAllMocks();
  products.list.mockResolvedValue({ success: true, data: [product(), product({ id: 'p2', name: 'Banana', nettWeightPerPackage: null, ratePerKg: null }), product({ id: 'p3', name: 'Retired Fruit', isActive: false })], error: null, meta: null });
});

describe('ProductPicker', () => {
  it('offers the active products and hands back the chosen product', async () => {
    const { onSelect, user } = setup();
    await user.click(screen.getByRole('combobox', { name: /Description of goods/ }));
    expect(await screen.findByRole('option', { name: /Alphonso Mango/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Retired Fruit/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Alphonso Mango/ }));
    expect(onSelect).toHaveBeenCalledWith('Alphonso Mango', expect.objectContaining({ id: 'p1', ratePerKg: '6.5' }));
  });

  it('finds a product by typing', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('combobox', { name: /Description of goods/ }));
    await screen.findByRole('option', { name: /Banana/ });
    await user.type(screen.getByRole('textbox', { name: /Search Description/ }), 'ban');
    expect(screen.getByRole('option', { name: /Banana/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Alphonso/ })).not.toBeInTheDocument();
  });

  it('uses text that is not in the list, without saving it', async () => {
    const { onSelect, user } = setup();
    await user.click(screen.getByRole('combobox', { name: /Description of goods/ }));
    await user.type(await screen.findByRole('textbox', { name: /Search Description/ }), 'Star Fruit');
    await user.click(screen.getByRole('option', { name: /Use “Star Fruit”/ }));
    expect(onSelect).toHaveBeenCalledWith('Star Fruit', undefined);
    expect(products.create).not.toHaveBeenCalled();
  });

  it('can save a new product while using it', async () => {
    products.create.mockResolvedValue({ success: true, data: product({ id: 'p9', name: 'Star Fruit' }), error: null, meta: null });
    const { onSelect, user } = setup();
    await user.click(screen.getByRole('combobox', { name: /Description of goods/ }));
    await user.type(await screen.findByRole('textbox', { name: /Search Description/ }), 'Star Fruit');
    await user.click(screen.getByRole('option', { name: /Add “Star Fruit”/ }));
    await waitFor(() => expect(products.create).toHaveBeenCalledWith({ name: 'Star Fruit' }));
    expect(onSelect).toHaveBeenCalledWith('Star Fruit', undefined);
  });

  it('does not offer to add a name that already exists', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('combobox', { name: /Description of goods/ }));
    await user.type(await screen.findByRole('textbox', { name: /Search Description/ }), 'banana');
    expect(screen.queryByRole('option', { name: /Use “/ })).not.toBeInTheDocument();
  });

  it('shows the current text on the closed field', () => {
    setup('Custom goods');
    expect(screen.getByRole('combobox', { name: /Description of goods/ })).toHaveTextContent('Custom goods');
  });
});

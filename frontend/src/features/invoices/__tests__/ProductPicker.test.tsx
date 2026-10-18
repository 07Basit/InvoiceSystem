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
  id: 'p1', name: 'Alphonso Mango', importerId: null, currency: null, locationName: null, nettWeightPerPackage: '10', ratePerKg: '6.5', hsCode: null, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});

function setup(value = '', scope: Parameters<typeof ProductPicker>[0]['scope'] = {}) {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  renderRoutes(<ProductPicker value={value} onSelect={onSelect} scope={scope} ariaLabel="Description of goods for product 1" />, { route: '/x', path: '/x' });
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

describe('ProductPicker for an importer', () => {
  const scoped = (over: Partial<Product>) => product({ nettWeightPerPackage: null, ratePerKg: null, ...over });
  beforeEach(() => {
    products.list.mockResolvedValue({
      success: true, error: null, meta: null,
      data: [
        product({ id: 'g1', name: 'Banana', ratePerKg: '2' }),
        scoped({ id: 's1', name: 'Banana', importerId: 'i1', currency: 'CAD', ratePerKg: '3.5' }),
        scoped({ id: 's2', name: 'Papaya', importerId: 'i1', currency: 'CAD', locationName: 'Toronto' }),
        scoped({ id: 's3', name: 'Lychee', importerId: 'i1', currency: 'USD' }),
        scoped({ id: 's4', name: 'Guava', importerId: 'i2', currency: 'CAD' }),
        scoped({ id: 's5', name: 'Fig', importerId: 'i1', currency: 'CAD', locationName: 'Montreal' }),
      ],
    });
  });

  it('lists the importer products first, then the general ones', async () => {
    const { user } = setup('', { importerId: 'i1', currency: 'CAD', locationName: 'Toronto' });
    await user.click(screen.getByRole('combobox', { name: /Description of goods/ }));
    await screen.findByRole('option', { name: /Papaya/ });
    const names = screen.getAllByRole('option').map((o) => o.textContent?.split(/\d/)[0]);
    expect(names.slice(0, 2)).toEqual(expect.arrayContaining(['Banana', 'Papaya']));
    expect(screen.getByText('For this importer')).toBeInTheDocument();
  });

  it('leaves out other importers, other currencies and other locations', async () => {
    const { user } = setup('', { importerId: 'i1', currency: 'CAD', locationName: 'Toronto' });
    await user.click(screen.getByRole('combobox', { name: /Description of goods/ }));
    await screen.findByRole('option', { name: /Papaya/ });
    expect(screen.queryByRole('option', { name: /Guava/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Lychee/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Fig/ })).not.toBeInTheDocument();
  });

  it('uses the importer entry (and its rate) when a name is also in the general list', async () => {
    const { onSelect, user } = setup('', { importerId: 'i1', currency: 'CAD', locationName: 'Toronto' });
    await user.click(screen.getByRole('combobox', { name: /Description of goods/ }));
    expect(screen.getAllByRole('option', { name: /Banana/ })).toHaveLength(1);
    await user.click(screen.getByRole('option', { name: /Banana/ }));
    expect(onSelect).toHaveBeenCalledWith('Banana', expect.objectContaining({ id: 's1', ratePerKg: '3.5' }));
  });

  it('saves a new product to the importer list', async () => {
    products.create.mockResolvedValue({ success: true, data: product({ id: 'n1', name: 'Star Fruit' }), error: null, meta: null });
    const { user } = setup('', { importerId: 'i1', currency: 'CAD', locationName: 'Toronto' });
    await user.click(screen.getByRole('combobox', { name: /Description of goods/ }));
    await user.type(await screen.findByRole('textbox', { name: /Search Description/ }), 'Star Fruit');
    await user.click(screen.getByRole('option', { name: /Add “Star Fruit”/ }));
    await waitFor(() => expect(products.create).toHaveBeenCalledWith({ name: 'Star Fruit', importerId: 'i1', currency: 'CAD', locationName: 'Toronto' }));
  });
});

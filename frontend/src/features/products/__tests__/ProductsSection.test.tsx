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

  it('lists products with their price only', async () => {
    products.list.mockResolvedValue(listOf(product({ nettWeightPerPackage: '10.000', ratePerKg: '6.5000', hsCode: '0804' })));
    render();
    expect(await screen.findByText('Alphonso Mango')).toBeInTheDocument();
    expect(screen.getByText('6.5 per kg')).toBeInTheDocument();
    expect(screen.queryByText(/10 kg|HS 0804/)).not.toBeInTheDocument();
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

  it('has just a name and a price in the form, and sends the price as a number', async () => {
    products.create.mockResolvedValue(one(product()));
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    await user.type(screen.getByLabelText('Product name'), 'Papaya');
    expect(screen.queryByLabelText(/nett weight/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/HS code/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Price per kg/), '2.5');
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    await waitFor(() => expect(products.create).toHaveBeenCalledWith({ name: 'Papaya', ratePerKg: 2.5 }));
  });

  it('asks for a name and refuses a zero rate', async () => {
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    await user.type(screen.getByLabelText(/Price per kg/), '0');
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

  it('picks the name from the general list when adding to an importer list, bringing its price', async () => {
    products.list.mockResolvedValue(listOf(product({ id: 'g1', name: 'Papaya', nettWeightPerPackage: '12', ratePerKg: '2.5', hsCode: '0807' }), product({ id: 'g2', name: 'Guava' })));
    products.create.mockResolvedValue(one(mineToronto));
    const user = userEvent.setup();
    renderRoutes(<ProductsSection scope={{ importerId: 'i1', currency: 'CAD', locationName: 'Toronto' }} />, { route: '/products', path: '/products' });
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    expect(screen.queryByRole('textbox', { name: 'Product name' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Product name' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent?.split(/\d/)[0])).toEqual(['Guava', 'Papaya']);
    await user.click(await screen.findByRole('option', { name: /Papaya/ }));
    expect(screen.getByLabelText(/Price per kg/)).toHaveValue('2.5');
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    await waitFor(() => expect(products.create).toHaveBeenCalledWith({ importerId: 'i1', currency: 'CAD', locationName: 'Toronto', name: 'Papaya', ratePerKg: 2.5 }));
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
    await user.type(screen.getByLabelText(/Price per kg/), '2.5');
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    await waitFor(() => expect(products.update).toHaveBeenCalledWith('p2', { importerId: 'i1', currency: 'CAD', name: 'Banana', ratePerKg: 2.5 }));
  });

  it('edits a product in place: its form replaces its row, with no second copy below', async () => {
    products.list.mockResolvedValue(listOf(product({ id: 'a', name: 'Banana' }), product({ id: 'b', name: 'Mango' })));
    const user = userEvent.setup();
    renderRoutes(<ProductsSection />, { route: '/products', path: '/products' });
    await user.click(await screen.findByRole('button', { name: 'Edit Banana' }));
    const form = screen.getByRole('form', { name: 'Edit product' });
    // the form sits inside the list, in the row of the product being edited
    expect(form.closest('li')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Banana' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Banana' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Product name')).toHaveValue('Banana');
    expect(screen.getByRole('button', { name: 'Edit Mango' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add product/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(screen.getByRole('button', { name: 'Edit Banana' })).toBeInTheDocument();
  });

  it('puts the form for a new product above the list', async () => {
    products.list.mockResolvedValue(listOf(product({ id: 'a', name: 'Banana' })));
    const user = userEvent.setup();
    renderRoutes(<ProductsSection />, { route: '/products', path: '/products' });
    await user.click(await screen.findByRole('button', { name: /Add product/ }));
    expect(screen.getByRole('form', { name: 'New product' }).closest('li')).toBeNull();
  });

  describe('a long list', () => {
    const names = ['Amla', 'Apple', 'Banana', 'Beetroot', 'Cabbage', 'Carrot', 'Chilli', 'Coconut', 'Dates', 'Drumstick', 'Fig', 'Garlic', 'Ginger', 'Grapes', 'Guava', 'Jackfruit', 'Lemon', 'Lychee', 'Mango', 'Okra', 'Papaya', 'Radish'];
    const many = () => listOf(...names.map((name, i) => product({ id: `p${i}`, name, isActive: name !== 'Fig' && name !== 'Dates' })));

    it('keeps search, the filters and Add product together in one bar, with a count', async () => {
      products.list.mockResolvedValue(many());
      renderRoutes(<ProductsSection />, { route: '/products', path: '/products' });
      await screen.findByText('Amla');
      const add = screen.getByRole('button', { name: /Add product/ });
      const bar = add.closest('.sticky');
      expect(bar).not.toBeNull();
      expect(bar).toContainElement(screen.getByRole('textbox', { name: 'Search products' }));
      expect(bar).toContainElement(screen.getByRole('group', { name: 'Show' }));
      expect(screen.getByText('22 products')).toBeInTheDocument();
    });

    it('shows how many match, can clear the search, and keeps the filter counts', async () => {
      products.list.mockResolvedValue(many());
      const user = userEvent.setup();
      renderRoutes(<ProductsSection />, { route: '/products', path: '/products' });
      await screen.findByText('Amla');
      await user.type(screen.getByRole('textbox', { name: 'Search products' }), 'an');
      expect(screen.getByText('Showing 2 of 22')).toBeInTheDocument();
      expect(screen.getByText('Banana')).toBeInTheDocument();
      expect(screen.getByText('Mango')).toBeInTheDocument();
      expect(screen.queryByText('Amla')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(screen.getByText('22 products')).toBeInTheDocument();
    });

    it('filters to the active or the not-needed products', async () => {
      products.list.mockResolvedValue(many());
      const user = userEvent.setup();
      renderRoutes(<ProductsSection />, { route: '/products', path: '/products' });
      await screen.findByText('Amla');
      await user.click(screen.getByRole('button', { name: 'Not needed (2)' }));
      expect(screen.getByText('Showing 2 of 22')).toBeInTheDocument();
      expect(screen.getByText('Fig')).toBeInTheDocument();
      expect(screen.queryByText('Mango')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Active (20)' }));
      expect(screen.queryByText('Fig')).not.toBeInTheDocument();
      expect(screen.getByText('Mango')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'All (22)' }));
      expect(screen.getByText('22 products')).toBeInTheDocument();
    });

    it('adds a letter heading for each first letter', async () => {
      products.list.mockResolvedValue(many());
      renderRoutes(<ProductsSection />, { route: '/products', path: '/products' });
      await screen.findByText('Amla');
      const letters = screen.getAllByRole('presentation').map((li) => li.textContent);
      expect(letters).toEqual(['A', 'B', 'C', 'D', 'F', 'G', 'J', 'L', 'M', 'O', 'P', 'R']);
    });

    it('has no letter headings or filter chips on a short list', async () => {
      products.list.mockResolvedValue(listOf(product({ id: 'a', name: 'Banana' })));
      renderRoutes(<ProductsSection />, { route: '/products', path: '/products' });
      await screen.findByText('Banana');
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Show' })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Search products' })).not.toBeInTheDocument();
    });
  });

  it('keeps the weight and HS code an edited product already has, even though they are not shown', async () => {
    const old = product({ id: 'w', name: 'Banana', nettWeightPerPackage: '12', ratePerKg: '2', hsCode: '0803' });
    products.list.mockResolvedValue(listOf(old));
    products.update.mockResolvedValue(one(old));
    const user = userEvent.setup();
    renderRoutes(<ProductsSection />, { route: '/products', path: '/products' });
    await user.click(await screen.findByRole('button', { name: 'Edit Banana' }));
    const rate = screen.getByLabelText(/Price per kg/);
    await user.clear(rate);
    await user.type(rate, '3');
    await user.click(screen.getByRole('button', { name: /Save product/ }));
    await waitFor(() => expect(products.update).toHaveBeenCalledWith('w', { name: 'Banana', ratePerKg: 3, nettWeightPerPackage: 12, hsCode: '0803' }));
  });
});

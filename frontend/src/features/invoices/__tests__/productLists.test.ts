import { describe, expect, it } from 'vitest';
import { listsForImporter, priceInList, scopeOfList } from '../utils/productLists';
import type { ProductList } from '../services/productListService';

const list = (id: string, over: Partial<ProductList> = {}): ProductList => ({ id, importerId: 'i1', currency: 'CAD', locationName: null, createdAt: '', ...over });
const lists = [
  list('all-cad'),
  list('toronto-cad', { locationName: 'Toronto' }),
  list('montreal-cad', { locationName: 'Montreal' }),
  list('all-usd', { currency: 'USD' }),
  list('other', { importerId: 'i2' }),
];

describe('listsForImporter', () => {
  it('keeps only this importer, the best match for the invoice first', () => {
    expect(listsForImporter(lists, { importerId: 'i1', currency: 'CAD', locationName: 'Toronto' }).map((l) => l.id)).toEqual(['toronto-cad', 'all-cad', 'montreal-cad', 'all-usd']);
  });

  it('is empty without an importer', () => {
    expect(listsForImporter(lists, {})).toEqual([]);
  });
});

describe('scopeOfList', () => {
  it('is the importer, currency and location of a list, and nothing for the general list', () => {
    expect(scopeOfList(list('x', { locationName: 'Toronto' }))).toEqual({ importerId: 'i1', currency: 'CAD', locationName: 'Toronto' });
    expect(scopeOfList(undefined)).toEqual({});
  });
});

describe('priceInList', () => {
  const p = (over: Record<string, unknown>) => ({ name: 'Banana', ratePerKg: null, isActive: true, importerId: null, currency: null, locationName: null, ...over });
  const products = [
    p({ ratePerKg: '2' }),
    p({ name: 'Mango' }),
    p({ ratePerKg: '3.5', importerId: 'i1', currency: 'CAD' }),
    p({ name: 'Papaya', ratePerKg: '0', importerId: 'i1', currency: 'CAD' }),
    p({ name: 'Fig', ratePerKg: '4', importerId: 'i1', currency: 'CAD', isActive: false }),
  ] as Parameters<typeof priceInList>[0];

  it('gives the price a list has for a product', () => {
    expect(priceInList(products, {}, 'Banana')).toEqual({ found: true, price: 2 });
    expect(priceInList(products, { importerId: 'i1', currency: 'CAD' }, 'Banana')).toEqual({ found: true, price: 3.5 });
  });

  it('ignores capitals and spaces around the name', () => {
    expect(priceInList(products, {}, '  banana ')).toEqual({ found: true, price: 2 });
  });

  it('is found without a price when the list names the product but gives no price (or zero)', () => {
    expect(priceInList(products, {}, 'Mango')).toEqual({ found: true, price: null });
    expect(priceInList(products, { importerId: 'i1', currency: 'CAD' }, 'Papaya')).toEqual({ found: true, price: null });
  });

  it('is not found when the product is not in that list, or is marked not needed', () => {
    expect(priceInList(products, { importerId: 'i1', currency: 'CAD' }, 'Mango')).toEqual({ found: false, price: null });
    expect(priceInList(products, { importerId: 'i1', currency: 'CAD' }, 'Fig')).toEqual({ found: false, price: null });
    expect(priceInList(products, {}, 'Star Fruit')).toEqual({ found: false, price: null });
  });
});

describe('priceIndex / priceFrom', () => {
  const row = (name: string, ratePerKg: string | null, extra = {}) => ({ name, ratePerKg, isActive: true, importerId: 'i1', currency: 'USD', locationName: null as string | null, ...extra });
  const scope = { importerId: 'i1', currency: 'USD', locationName: undefined };

  it('finds a product by name in one lookup, ignoring case and spaces', async () => {
    const { priceIndex, priceFrom } = await import('../utils/productLists');
    const index = priceIndex([row('Banana', '1.5'), row('Mango', null)], scope);
    expect(priceFrom(index, '  banana ')).toEqual({ found: true, price: 1.5 });
    expect(priceFrom(index, 'Mango')).toEqual({ found: true, price: null });
    expect(priceFrom(index, 'Grape')).toEqual({ found: false, price: null });
  });

  it('leaves out inactive products and other scopes, and the first match wins', async () => {
    const { priceIndex, priceFrom } = await import('../utils/productLists');
    const index = priceIndex([row('A', '9', { isActive: false }), row('B', '2', { currency: 'EUR' }), row('C', '3'), row('C', '4')], scope);
    expect(priceFrom(index, 'A').found).toBe(false);
    expect(priceFrom(index, 'B').found).toBe(false);
    expect(priceFrom(index, 'C').price).toBe(3);
  });
});

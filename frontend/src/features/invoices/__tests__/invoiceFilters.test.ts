import { describe, expect, it } from 'vitest';
import { activeQuickDate, countActive, filterChips, filtersToQuery, isEmptyFilters, noFilters, quickRange, removeChip } from '../utils/invoiceFilters';

const f = (over: Partial<typeof noFilters>) => ({ ...noFilters, ...over });

describe('filtersToQuery', () => {
  it('sends nothing when nothing is filtered', () => {
    expect(filtersToQuery(noFilters)).toEqual({});
  });

  it('joins lists with commas and leaves empty ones out', () => {
    expect(filtersToQuery(f({ importerIds: ['a', 'b'], currencies: ['CAD'], years: ['2025', '2026'], type: 'actual', kind: 'custom', minTotal: '100', maxTotal: '', dateFrom: '2026-01-01' }))).toEqual({
      importerId: 'a,b', currency: 'CAD', year: '2025,2026', type: 'actual', kind: 'custom', minTotal: 100, dateFrom: '2026-01-01',
    });
  });

  it('ignores an amount that is not a number', () => {
    expect(filtersToQuery(f({ minTotal: 'abc' }))).toEqual({});
  });
});

describe('counting', () => {
  it('counts each filtered thing once (a range is one)', () => {
    expect(countActive(noFilters)).toBe(0);
    expect(isEmptyFilters(noFilters)).toBe(true);
    expect(countActive(f({ importerIds: ['a', 'b'], dateFrom: '2026-01-01', dateTo: '2026-02-01', minTotal: '5', type: 'regular' }))).toBe(4);
  });
});

describe('quick dates', () => {
  const today = new Date(2026, 9, 18); // 18 Oct 2026
  it('knows this month, last month, this year and last year', () => {
    expect(quickRange('thisMonth', today)).toEqual({ dateFrom: '2026-10-01', dateTo: '2026-10-31' });
    expect(quickRange('lastMonth', today)).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    expect(quickRange('thisYear', today)).toEqual({ dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    expect(quickRange('lastYear', today)).toEqual({ dateFrom: '2025-01-01', dateTo: '2025-12-31' });
  });

  it('wraps last month across a new year, and handles February', () => {
    expect(quickRange('lastMonth', new Date(2026, 0, 5))).toEqual({ dateFrom: '2025-12-01', dateTo: '2025-12-31' });
    expect(quickRange('thisMonth', new Date(2028, 1, 10))).toEqual({ dateFrom: '2028-02-01', dateTo: '2028-02-29' });
  });

  it('says which quick choice is active', () => {
    expect(activeQuickDate({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }, today)).toBe('thisMonth');
    expect(activeQuickDate({ dateFrom: '2026-10-02', dateTo: '2026-10-31' }, today)).toBeNull();
  });
});

describe('chips', () => {
  const all = f({ importerIds: ['i1'], currencies: ['CAD'], months: ['3'], dateFrom: '2026-01-01', dateTo: '2026-02-01', minTotal: '100', maxTotal: '500', loadingPorts: ['BOM'], dischargePorts: ['YUL'], products: ['Banana'], type: 'actual' });
  const chips = filterChips(all, (id) => (id === 'i1' ? 'KJ Fruits' : id));

  it('has one readable chip per value', () => {
    expect(chips.map((c) => c.label)).toEqual(['KJ Fruits', 'CAD', 'March', '1 Jan 2026 to 1 Feb 2026', 'Amount 100 to 500', 'From BOM', 'To YUL', 'Banana', 'Actual only']);
  });

  it('removes only the value a chip stands for', () => {
    const two = f({ currencies: ['CAD', 'USD'] });
    const cad = filterChips(two, (id) => id)[0]!;
    expect(removeChip(two, cad).currencies).toEqual(['USD']);
    expect(removeChip(all, chips.find((c) => c.key === 'dates')!)).toMatchObject({ dateFrom: '', dateTo: '', currencies: ['CAD'] });
    expect(removeChip(all, chips.find((c) => c.key === 'amount')!)).toMatchObject({ minTotal: '', maxTotal: '' });
    expect(removeChip(all, chips.find((c) => c.key === 'type')!).type).toBe('all');
  });
});

describe('party / custom filter', () => {
  it('is sent, counted and shown as a chip, and can be removed', () => {
    const custom = f({ kind: 'custom' });
    expect(filtersToQuery(custom)).toEqual({ kind: 'custom' });
    expect(countActive(custom)).toBe(1);
    const chip = filterChips(custom, (id) => id)[0]!;
    expect(chip.label).toBe('Custom invoices');
    expect(removeChip(custom, chip).kind).toBe('all');
    expect(filterChips(f({ kind: 'party' }), (id) => id)[0]!.label).toBe('Party invoices');
    expect(filterChips(f({ kind: 'normal' }), (id) => id)[0]!.label).toBe('Normal invoices');
    expect(filtersToQuery(f({ kind: 'normal' }))).toEqual({ kind: 'normal' });
    expect(filtersToQuery(f({ kind: 'all' }))).toEqual({});
  });
});

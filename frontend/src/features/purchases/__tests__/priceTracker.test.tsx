import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PriceOverviewItem, PricePoint } from 'shared';
import PriceOverview from '../components/PriceOverview';
import { purchaseService } from '../services/purchaseService';
import { changePercent, gapOf, supplierStats, withChange } from '../utils/priceStats';
import { noPurchaseFilters } from '../utils/purchaseFilters';
import { renderRoutes } from '@/__tests__/utils';

vi.mock('../services/purchaseService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/purchaseService')>()),
  purchaseService: { overview: vi.fn() },
}));
const service = vi.mocked(purchaseService);

const point = (over: Partial<PricePoint>): PricePoint => ({ date: '2026-10-10', rate: 40, sale: null, netWeight: 100, supplierId: 'a', supplierName: 'Mapoose', invoiceId: 'p1', invoiceNumber: 'N1', ...over });

describe('price statistics', () => {
  it('works out a percent change, or none without an earlier rate', () => {
    expect(changePercent(46, 40)).toBe(15);
    expect(changePercent(46, null)).toBeNull();
  });

  it('compares each purchase only with the same supplier\'s one before', () => {
    const rows = withChange([point({ rate: 40 }), point({ supplierId: 'b', supplierName: 'Sunil', rate: 90, date: '2026-10-12' }), point({ rate: 46, date: '2026-10-20' })]);
    expect(rows.map((r) => r.change)).toEqual([null, null, 15]);
  });

  it('lists each supplier with the cheapest latest rate first', () => {
    const stats = supplierStats([point({ rate: 40 }), point({ rate: 46, date: '2026-10-20' }), point({ supplierId: 'b', supplierName: 'Sunil', rate: 42, date: '2026-10-15' })]);
    expect(stats.map((s) => [s.supplierName, s.latest.rate, s.change, s.purchases, s.average])).toEqual([['Sunil', 42, null, 1, 42], ['Mapoose', 46, 15, 2, 43]]);
  });

  it('shows the gain per kg between what was charged (in rupees) and what was paid', () => {
    expect(gapOf(point({ rate: 40, sale: { invoiceId: 'i', invoiceNumber: 'A', currency: 'CAD', rate: 1, rateInr: 60, fxRate: 60 } }))).toEqual({ amount: 20, percent: 50 });
    expect(gapOf(point({ sale: { invoiceId: 'i', invoiceNumber: 'A', currency: 'CAD', rate: 1, rateInr: null, fxRate: null } }))).toBeNull();
    expect(gapOf(point({}))).toBeNull();
  });
});

const item = (over: Partial<PriceOverviewItem>): PriceOverviewItem => ({
  product: 'Amla', purchases: 3, suppliers: 2, latest: { rate: 46, date: '2026-10-26', supplierName: 'Mapoose' }, previousRate: 40, changePercent: 15,
  cheapest: { supplierName: 'Sunil', rate: 42 }, lowest: 40, highest: 46, average: 42.67, series: [{ date: '2026-10-10', rate: 40 }, { date: '2026-10-26', rate: 46 }], sale: null, ...over,
});

describe('PriceOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.overview.mockResolvedValue([
      item({}),
      item({ product: 'Okra', changePercent: -10, latest: { rate: 50, date: '2026-10-25', supplierName: 'Sunil' }, cheapest: null, suppliers: 1 }),
      item({ product: 'Mango', changePercent: null, previousRate: null, cheapest: null, suppliers: 1, sale: { invoiceId: 'i', invoiceNumber: 'ACTUAL 1', currency: 'CAD', rate: 1.5, rateInr: 100, buyRate: 46, date: '2026-10-26' } }),
    ]);
  });

  const render = (onOpen = vi.fn()) => renderRoutes(<PriceOverview filters={noPurchaseFilters} onFiltersChange={vi.fn()} onOpenFilters={vi.fn()} onOpenProduct={onOpen} onCount={vi.fn()} />);

  it('shows a card for each product with its latest rate, move and cheapest supplier', async () => {
    render();
    const amla = await screen.findByRole('button', { name: /Amla, latest/ });
    expect(within(amla).getByText('+15%')).toBeInTheDocument();
    expect(within(amla).getByText(/Sunil/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mango, latest/ })).toHaveTextContent('first purchase');
    expect(screen.getByRole('button', { name: /Mango, latest/ })).toHaveTextContent('vs bought');
  });

  it('narrows to the products getting dearer, cheaper or sold on an invoice', async () => {
    render();
    await screen.findByRole('button', { name: /Amla, latest/ });
    await userEvent.click(screen.getByRole('tab', { name: /Getting cheaper/ }));
    expect(screen.queryByRole('button', { name: /Amla, latest/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Okra, latest/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Sold on an invoice/ }));
    expect(screen.getByRole('button', { name: /Mango, latest/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Okra, latest/ })).not.toBeInTheDocument();
  });

  it('searches by name and opens a product', async () => {
    const open = vi.fn();
    render(open);
    await userEvent.type(await screen.findByLabelText('Search a product'), 'ok');
    expect(screen.queryByRole('button', { name: /Amla, latest/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Okra, latest/ }));
    expect(open).toHaveBeenCalledWith('Okra');
  });

  it('sorts by the biggest rise', async () => {
    render();
    await screen.findByRole('button', { name: /Amla, latest/ });
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'rise');
    const names = screen.getAllByRole('button', { name: /, latest/ }).map((b) => b.getAttribute('aria-label')!.split(',')[0]);
    expect(names).toEqual(['Amla', 'Okra', 'Mango']);
  });
});

import { listInvoicesQuerySchema } from 'shared';
import { prismaMock } from './setup';
import { invoiceService } from '../services/invoice.service';

const list = (q: Record<string, unknown>) => invoiceService.list({ page: 1, limit: 20, order: 'desc', sort: 'createdAt', ...q } as never);
const whereOf = () => (prismaMock.invoice.findMany.mock.calls.at(-1)![0] as { where: Record<string, any> }).where;

beforeEach(() => {
  prismaMock.$transaction.mockResolvedValue([[], 0] as never);
});

describe('listInvoicesQuerySchema', () => {
  it('turns comma-separated text into lists', () => {
    const q = listInvoicesQuerySchema.parse({ currency: 'cad, usd,', year: '2025,2026', month: '3,4', loadingPort: 'BOM,DEL' });
    expect(q.currency).toEqual(['CAD', 'USD']);
    expect(q.year).toEqual([2025, 2026]);
    expect(q.month).toEqual([3, 4]);
    expect(q.loadingPort).toEqual(['BOM', 'DEL']);
  });

  it('checks the new filters', () => {
    expect(listInvoicesQuerySchema.safeParse({ dateFrom: '31/10/2026' }).success).toBe(false);
    expect(listInvoicesQuerySchema.safeParse({ minTotal: '-5' }).success).toBe(false);
    expect(listInvoicesQuerySchema.safeParse({ type: 'other' }).success).toBe(false);
    expect(listInvoicesQuerySchema.safeParse({ month: '13' }).success).toBe(false);
    const ok = listInvoicesQuerySchema.parse({ dateFrom: '2026-01-01', dateTo: '2026-10-31', minTotal: '100', maxTotal: '5000', type: 'actual' });
    expect(ok).toMatchObject({ dateFrom: '2026-01-01', dateTo: '2026-10-31', minTotal: 100, maxTotal: 5000, type: 'actual' });
  });
});

describe('invoiceService.list with several values and the new filters', () => {
  it('matches any of several importers and currencies', async () => {
    await list({ importerId: ['a', 'b'], currency: ['CAD', 'USD'] });
    expect(whereOf()).toMatchObject({ importerId: { in: ['a', 'b'] }, currency: { in: ['CAD', 'USD'] } });
  });

  it('matches any of several years, as one range each', async () => {
    await list({ year: [2025, 2026] });
    const clause = whereOf()['AND'][0].OR as Array<{ invoiceDate: { gte: Date; lt: Date } }>;
    expect(clause.map((c) => c.invoiceDate.gte.toISOString())).toEqual(['2025-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']);
    expect(whereOf()['invoiceDate']).toBeUndefined();
  });

  it('looks up the ids of several months', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: 'x' }] as never);
    await list({ month: [3, 4] });
    expect(whereOf()['AND']).toEqual([{ id: { in: ['x'] } }]);
  });

  it('filters by a date range, counting the last day in full', async () => {
    await list({ dateFrom: '2026-01-01', dateTo: '2026-10-31' });
    const range = whereOf()['AND'][0].invoiceDate as { gte: Date; lt: Date };
    expect([range.gte.toISOString(), range.lt.toISOString()]).toEqual(['2026-01-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z']);
  });

  it('filters by amount, with either end optional', async () => {
    await list({ minTotal: 100 });
    expect(whereOf()['total']).toEqual({ gte: 100 });
    await list({ minTotal: 100, maxTotal: 5000 });
    expect(whereOf()['total']).toEqual({ gte: 100, lte: 5000 });
  });

  it('filters by route, product and exporter', async () => {
    await list({ loadingPort: ['BOM'], dischargePort: ['YUL'], country: ['Canada'], product: ['Banana'], exporter: ['Blue Ocean Exports'] });
    const and = whereOf()['AND'] as Array<Record<string, any>>;
    expect(and).toContainEqual({ portOfLoading: { in: ['BOM'] } });
    expect(and).toContainEqual({ OR: [{ portOfDischarge: { in: ['YUL'] } }, { finalDestination: { in: ['YUL'] } }] });
    expect(and).toContainEqual({ countryOfDestination: { in: ['Canada'] } });
    expect(and).toContainEqual({ lineItems: { some: { descriptionOfGoods: { in: ['Banana'] } } } });
    expect(and).toContainEqual({ exporterName: { in: ['Blue Ocean Exports'] } });
  });

  it('splits regular invoices from actual copies', async () => {
    await list({ type: 'regular' });
    expect(whereOf()['actualOfId']).toBeNull();
    await list({ type: 'actual' });
    expect(whereOf()['actualOfId']).toEqual({ not: null });
    await list({ type: 'all' });
    expect(whereOf()['actualOfId']).toBeUndefined();
  });

  it('ignores blank values', async () => {
    await list({ importerId: [], currency: '', year: [] });
    expect(whereOf()).toEqual({ deletedAt: null, isCompanion: false });
  });
});

describe('invoiceService.filterOptions', () => {
  it('offers each value once, tidied, even when saved in different capitals', async () => {
    prismaMock.invoice.findMany
      .mockResolvedValueOnce([{ invoiceDate: new Date('2026-03-01') }, { invoiceDate: new Date('2025-07-01') }, { invoiceDate: new Date('2026-09-01') }] as never)
      .mockResolvedValueOnce([{ currency: 'cad' }, { currency: 'CAD' }, { currency: 'USD' }] as never)
      .mockResolvedValueOnce([{ portOfLoading: 'bom' }, { portOfLoading: 'BOM' }, { portOfLoading: null }] as never)
      .mockResolvedValueOnce([{ portOfDischarge: 'yul' }] as never)
      .mockResolvedValueOnce([{ finalDestination: 'YUL' }, { finalDestination: 'yyz' }] as never)
      .mockResolvedValueOnce([{ countryOfDestination: 'Canada' }] as never)
      .mockResolvedValueOnce([{ exporterName: 'Blue Ocean Exports' }] as never);
    prismaMock.lineItem.findMany.mockResolvedValue([{ descriptionOfGoods: 'Banana' }, { descriptionOfGoods: 'banana' }, { descriptionOfGoods: 'Mango' }] as never);
    const options = await invoiceService.filterOptions();
    expect(options).toEqual({
      years: [2026, 2025],
      currencies: ['CAD', 'USD'],
      loadingPorts: ['BOM'],
      dischargePorts: ['YUL', 'YYZ'],
      countries: ['Canada'],
      exporters: ['Blue Ocean Exports'],
      products: ['Banana', 'Mango'],
    });
  });
});

import { prismaMock } from './setup';
import { invoiceService } from '../services/invoice.service';

// the HTTP layer hands these over as text, so the tests do too
const list = (q: Record<string, unknown>) => invoiceService.list({ page: 1, limit: 20, order: 'desc', sort: 'createdAt', ...q } as never);
const whereOf = () => (prismaMock.invoice.findMany.mock.calls.at(-1)![0] as { where: Record<string, unknown> }).where;

beforeEach(() => {
  prismaMock.$transaction.mockResolvedValue([[], 0] as never);
});

describe('invoiceService.list date and currency filters', () => {
  it('turns a year given as text into a one-year range (not the year 20231)', async () => {
    await list({ year: '2023' });
    const range = whereOf()['invoiceDate'] as { gte: Date; lt: Date };
    expect(range.gte.toISOString()).toBe('2023-01-01T00:00:00.000Z');
    expect(range.lt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('turns a year and month into that month only, including December rolling into January', async () => {
    await list({ year: '2026', month: '10' });
    let range = whereOf()['invoiceDate'] as { gte: Date; lt: Date };
    expect([range.gte.toISOString(), range.lt.toISOString()]).toEqual(['2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z']);

    await list({ year: '2026', month: '12' });
    range = whereOf()['invoiceDate'] as { gte: Date; lt: Date };
    expect([range.gte.toISOString(), range.lt.toISOString()]).toEqual(['2026-12-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z']);
  });

  it('looks up the ids of a month on its own, across every year', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }] as never);
    await list({ month: '6' });
    expect(whereOf()['id']).toEqual({ in: ['a', 'b'] });
    expect(whereOf()['invoiceDate']).toBeUndefined();
  });

  it('filters by currency and importer, and adds nothing when no filter is given', async () => {
    await list({ currency: 'AED', importerId: 'imp1' });
    expect(whereOf()).toMatchObject({ deletedAt: null, currency: 'AED', importerId: 'imp1' });

    await list({});
    expect(whereOf()).toEqual({ deletedAt: null });
  });
});

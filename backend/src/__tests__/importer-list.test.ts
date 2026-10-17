import { prismaMock } from './setup';
import { importerService } from '../services/importer.service';

const list = (q: Record<string, unknown>) => importerService.list({ page: 1, limit: 12, order: 'asc', sort: 'name', status: 'all', ...q } as never);
const callArgs = () => prismaMock.importer.findMany.mock.calls.at(-1)![0] as { where: Record<string, unknown>; orderBy: unknown; skip: number; take: number };

beforeEach(() => {
  prismaMock.$transaction.mockResolvedValue([[], 0] as never);
});

describe('importerService.list', () => {
  it('pages with skip/take and reports the page meta', async () => {
    prismaMock.$transaction.mockResolvedValue([[], 25] as never);
    const result = await list({ page: 3, limit: 10 });
    expect(callArgs()).toMatchObject({ skip: 20, take: 10 });
    expect(result.meta).toEqual({ page: 3, limit: 10, total: 25, totalPages: 3, hasNext: false, hasPrev: true });
  });

  it('lists active importers first, then by the chosen order, with id as a stable tiebreak', async () => {
    await list({ sort: 'name', order: 'asc' });
    expect(callArgs().orderBy).toEqual([{ isActive: 'desc' }, { name: 'asc' }, { id: 'asc' }]);
  });

  it('filters by status', async () => {
    await list({ status: 'active' });
    expect(callArgs().where).toMatchObject({ deletedAt: null, isActive: true });
    await list({ status: 'inactive' });
    expect(callArgs().where).toMatchObject({ deletedAt: null, isActive: false });
    await list({ status: 'all' });
    expect(callArgs().where).toEqual({ deletedAt: null });
  });

  it('needs every typed word to match, searching ports and countries as well as names', async () => {
    await list({ search: '  trv   canada ' });
    const and = callArgs().where['AND'] as Array<{ OR: unknown[] }>;
    expect(and).toHaveLength(2); // one group per word
    const flat = JSON.stringify(and[0]);
    for (const field of ['name', 'buyerName', 'contact', 'email', 'address', 'currency', 'portOfDischarge', 'portOfLoading', 'countryOfDestination', 'countryOfOrigin']) {
      expect(flat).toContain(`"${field}"`);
    }
    expect(flat).toContain('"trv"'.replace('"trv"', 'trv'));
  });

  it('adds no search condition for blank text', async () => {
    await list({ search: '   ' });
    expect(callArgs().where['AND']).toBeUndefined();
  });
});

describe('importerService.summary', () => {
  it('returns total, active and inactive counts', async () => {
    prismaMock.importer.count.mockResolvedValueOnce(9 as never).mockResolvedValueOnce(6 as never);
    expect(await importerService.summary()).toEqual({ total: 9, active: 6, inactive: 3 });
  });
});

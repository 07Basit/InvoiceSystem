import { prismaMock } from './setup';
import { invoiceService } from '../services/invoice.service';
import { importerService } from '../services/importer.service';
import { documentService } from '../services/document.service';

// SQL Server rejects Prisma's `mode: 'insensitive'` (PostgreSQL-only). Its default collation is
// already case-insensitive, so `contains` alone is the correct filter.
const hasInsensitiveMode = (where: unknown) => JSON.stringify(where).includes('insensitive');

beforeEach(() => {
  prismaMock.$transaction.mockResolvedValue([[], 0] as never);
});

describe('search filters (SQL Server compatible)', () => {
  it('invoices: searches number, importer name and buyer without a `mode` option', async () => {
    await invoiceService.list({ search: 'abc', page: 1, limit: 20 } as never);
    const { where } = prismaMock.invoice.findMany.mock.calls[0]![0]!;
    expect(where).toEqual({
      deletedAt: null,
      OR: [
        { invoiceNumber: { contains: 'abc' } },
        { importer: { name: { contains: 'abc' } } },
        { buyerName: { contains: 'abc' } },
      ],
    });
    expect(hasInsensitiveMode(where)).toBe(false);
  });

  it('importers: searches name, buyer and contact', async () => {
    await importerService.list({ search: 'maple', page: 1, limit: 20 } as never);
    const { where } = prismaMock.importer.findMany.mock.calls[0]![0]!;
    expect(where).toEqual({
      deletedAt: null,
      OR: [{ name: { contains: 'maple' } }, { buyerName: { contains: 'maple' } }, { contact: { contains: 'maple' } }],
    });
    expect(hasInsensitiveMode(where)).toBe(false);
  });

  it('documents: searches title', async () => {
    await documentService.list({ search: 'report', page: 1, limit: 20 } as never);
    const { where } = prismaMock.document.findMany.mock.calls[0]![0]!;
    expect(where).toEqual({ deletedAt: null, OR: [{ title: { contains: 'report' } }] });
    expect(hasInsensitiveMode(where)).toBe(false);
  });

  it('adds no search clause when the search box is empty', async () => {
    await invoiceService.list({ page: 1, limit: 20 } as never);
    expect(prismaMock.invoice.findMany.mock.calls[0]![0]!.where).toEqual({ deletedAt: null });
  });

  it('reports pagination metadata from the count', async () => {
    prismaMock.$transaction.mockResolvedValue([[{ id: 'a' }], 45] as never);
    const result = await invoiceService.list({ page: 2, limit: 20 } as never);
    expect(result.meta).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3, hasNext: true, hasPrev: true });
  });
});

import { prismaMock } from './setup';
import { invoiceService } from '../services/invoice.service';
import { importerService } from '../services/importer.service';
import { documentService } from '../services/document.service';

// PostgreSQL compares text exactly, so every search asks for `mode: 'insensitive'` to ignore capitals.
const hasInsensitiveMode = (where: unknown) => JSON.stringify(where).includes('insensitive');

beforeEach(() => {
  prismaMock.$transaction.mockResolvedValue([[], 0] as never);
});

describe('search filters (ignore capitals)', () => {
  it('invoices: searches number, importer name (live and the invoice own copy) and buyer, ignoring capitals', async () => {
    await invoiceService.list({ search: 'abc', page: 1, limit: 20 } as never);
    const { where } = prismaMock.invoice.findMany.mock.calls[0]![0]!;
    expect(where).toEqual({
      deletedAt: null,
      isCompanion: false,
      OR: [
        { invoiceNumber: { contains: 'abc', mode: 'insensitive' } },
        { importer: { name: { contains: 'abc', mode: 'insensitive' } } },
        { importerName: { contains: 'abc', mode: 'insensitive' } },
        { buyerName: { contains: 'abc', mode: 'insensitive' } },
      ],
    });
    expect(hasInsensitiveMode(where)).toBe(true);
  });

  it('importers: searches name, buyer, contact, email, address, currency, ports and countries', async () => {
    await importerService.list({ search: 'maple', page: 1, limit: 20 } as never);
    const { where } = prismaMock.importer.findMany.mock.calls[0]![0]!;
    // one group per typed word; the word may match any of these fields
    expect(where).toMatchObject({ deletedAt: null, AND: [{ OR: expect.any(Array) }] });
    const group = JSON.stringify((where as { AND: unknown[] }).AND[0]);
    for (const field of ['name', 'buyerName', 'contact', 'email', 'address', 'currency', 'portOfDischarge', 'portOfLoading', 'countryOfDestination', 'countryOfOrigin']) {
      expect(group).toContain(`"${field}":{"contains":"maple","mode":"insensitive"}`);
    }
    expect(hasInsensitiveMode(where)).toBe(true);
  });

  it('documents: searches title', async () => {
    await documentService.list({ search: 'report', page: 1, limit: 20 } as never);
    const { where } = prismaMock.document.findMany.mock.calls[0]![0]!;
    expect(where).toEqual({ deletedAt: null, OR: [{ title: { contains: 'report', mode: 'insensitive' } }] });
    expect(hasInsensitiveMode(where)).toBe(true);
  });

  it('adds no search clause when the search box is empty', async () => {
    await invoiceService.list({ page: 1, limit: 20 } as never);
    expect(prismaMock.invoice.findMany.mock.calls[0]![0]!.where).toEqual({ deletedAt: null, isCompanion: false });
  });

  it('reports pagination metadata from the count', async () => {
    prismaMock.$transaction.mockResolvedValue([[{ id: 'a' }], 45] as never);
    const result = await invoiceService.list({ page: 2, limit: 20 } as never);
    expect(result.meta).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3, hasNext: true, hasPrev: true });
  });
});

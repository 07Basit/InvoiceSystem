import { prismaMock } from './setup';
import { recycleService } from '../services/recycle.service';

describe('recycleService.restore', () => {
  it('restores a soft-deleted invoice', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'i1' } as never);
    prismaMock.invoice.update.mockResolvedValue({ id: 'i1', deletedAt: null } as never);
    await recycleService.restore('invoice', 'i1');
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { deletedAt: null } });
  });

  it('404s when the deleted record does not exist', async () => {
    prismaMock.importer.findFirst.mockResolvedValue(null);
    await expect(recycleService.restore('importer', 'nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('400s for an unknown record type instead of returning undefined', async () => {
    await expect(recycleService.restore('document' as never, 'x')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TYPE' });
  });
});

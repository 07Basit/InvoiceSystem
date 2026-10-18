import { prismaMock } from './setup';
import { draftService, draftTitle, MAX_DRAFTS_PER_KIND, MAX_DRAFT_CHARS } from '../services/draft.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'd1', userId: 'u1', kind: 'invoice', title: 'INV-1', data: JSON.stringify({ invoiceNumber: 'INV-1' }),
  createdAt: new Date('2026-10-17T00:00:00Z'), updatedAt: new Date('2026-10-17T01:00:00Z'), ...over,
});

describe('draftTitle', () => {
  it('uses the invoice number or the importer name typed so far', () => {
    expect(draftTitle('invoice', { invoiceNumber: '  INV-9 ' })).toBe('INV-9');
    expect(draftTitle('importer', { name: 'ABC Foods' })).toBe('ABC Foods');
  });
  it('is null when nothing useful was typed', () => {
    expect(draftTitle('invoice', { invoiceNumber: '   ' })).toBeNull();
    expect(draftTitle('importer', {})).toBeNull();
    expect(draftTitle('importer', { name: 5 })).toBeNull();
  });
});

describe('draftService', () => {
  it("lists only the signed-in person's drafts of one kind, newest first, with parsed data", async () => {
    prismaMock.draft.findMany.mockResolvedValue([row()] as never);
    const result = await draftService.list('u1', 'invoice');
    expect(prismaMock.draft.findMany).toHaveBeenCalledWith({ where: { userId: 'u1', kind: 'invoice' }, orderBy: { updatedAt: 'desc' } });
    expect(result[0]).toMatchObject({ id: 'd1', kind: 'invoice', title: 'INV-1', data: { invoiceNumber: 'INV-1' } });
  });

  it('shows a damaged draft as empty instead of failing the list', async () => {
    prismaMock.draft.findMany.mockResolvedValue([row({ data: '{not json' })] as never);
    expect((await draftService.list('u1', 'invoice'))[0]!.data).toEqual({});
  });

  it('saves a draft for the person with a title from the form, keeping an imported date', async () => {
    prismaMock.draft.count.mockResolvedValue(0);
    prismaMock.draft.create.mockResolvedValue(row() as never);
    await draftService.create('u1', { kind: 'importer', data: { name: 'ABC Foods' }, createdAt: '2026-10-01T00:00:00.000Z' });
    expect(prismaMock.draft.create).toHaveBeenCalledWith({
      data: { userId: 'u1', kind: 'importer', title: 'ABC Foods', data: JSON.stringify({ name: 'ABC Foods' }), createdAt: new Date('2026-10-01T00:00:00.000Z') },
    });
  });

  it('refuses a draft that is too large, or too many drafts', async () => {
    prismaMock.draft.count.mockResolvedValue(0);
    await expect(draftService.create('u1', { kind: 'invoice', data: { blob: 'x'.repeat(MAX_DRAFT_CHARS) } })).rejects.toMatchObject({ statusCode: 413 });
    prismaMock.draft.count.mockResolvedValue(MAX_DRAFTS_PER_KIND);
    await expect(draftService.create('u1', { kind: 'invoice', data: {} })).rejects.toMatchObject({ code: 'TOO_MANY_DRAFTS' });
  });

  it("will not touch someone else's draft", async () => {
    prismaMock.draft.findFirst.mockResolvedValue(null);
    await expect(draftService.update('u2', 'd1', { data: {} })).rejects.toMatchObject({ statusCode: 404 });
    await expect(draftService.remove('u2', 'd1')).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.draft.findFirst).toHaveBeenCalledWith({ where: { id: 'd1', userId: 'u2' } });
    expect(prismaMock.draft.update).not.toHaveBeenCalled();
    expect(prismaMock.draft.delete).not.toHaveBeenCalled();
  });

  it('updates the values and the title of your own draft', async () => {
    prismaMock.draft.findFirst.mockResolvedValue(row() as never);
    prismaMock.draft.update.mockResolvedValue(row({ title: 'INV-2' }) as never);
    await draftService.update('u1', 'd1', { data: { invoiceNumber: 'INV-2' } });
    expect(prismaMock.draft.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { data: JSON.stringify({ invoiceNumber: 'INV-2' }), title: 'INV-2' } });
  });

  it('deletes your own draft', async () => {
    prismaMock.draft.findFirst.mockResolvedValue(row() as never);
    await draftService.remove('u1', 'd1');
    expect(prismaMock.draft.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftService } from '../services/draftService';
import { importBrowserDrafts } from '../hooks/useImportBrowserDrafts';

const INVOICE_KEY = 'invoice-draft-list-v1';
const IMPORTER_KEY = 'importer-draft-list-v1';

const stored = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null');

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('importBrowserDrafts', () => {
  it('does nothing when the browser has no drafts', async () => {
    const create = vi.spyOn(draftService, 'create');
    expect(await importBrowserDrafts('invoice')).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it('moves each browser draft to the database, keeping its date, then clears the browser copy', async () => {
    localStorage.setItem(INVOICE_KEY, JSON.stringify([
      { id: 'draft-1', createdAt: '2026-10-01T10:00:00.000Z', data: { invoiceNumber: 'A' } },
      { id: 'draft-2', createdAt: '2026-10-02T10:00:00.000Z', data: { invoiceNumber: 'B' } },
    ]));
    const create = vi.spyOn(draftService, 'create').mockResolvedValue({} as never);
    expect(await importBrowserDrafts('invoice')).toBe(2);
    expect(create).toHaveBeenNthCalledWith(1, 'invoice', { invoiceNumber: 'A' }, '2026-10-01T10:00:00.000Z');
    expect(create).toHaveBeenNthCalledWith(2, 'invoice', { invoiceNumber: 'B' }, '2026-10-02T10:00:00.000Z');
    expect(localStorage.getItem(INVOICE_KEY)).toBeNull();
  });

  it('keeps the drafts it could not move, so nothing is lost and nothing is saved twice on the next try', async () => {
    localStorage.setItem(IMPORTER_KEY, JSON.stringify([
      { id: 'd1', createdAt: '2026-10-01T10:00:00.000Z', data: { name: 'One' } },
      { id: 'd2', createdAt: '2026-10-02T10:00:00.000Z', data: { name: 'Two' } },
      { id: 'd3', createdAt: '2026-10-03T10:00:00.000Z', data: { name: 'Three' } },
    ]));
    vi.spyOn(draftService, 'create').mockResolvedValueOnce({} as never).mockRejectedValueOnce(new Error('offline'));
    expect(await importBrowserDrafts('importer')).toBe(1);
    expect(stored(IMPORTER_KEY).map((d: { id: string }) => d.id)).toEqual(['d2', 'd3']);
  });

  it('skips and drops entries that are not drafts, and ignores a damaged list', async () => {
    localStorage.setItem(INVOICE_KEY, JSON.stringify([{ id: 'x' }, { id: 'y', data: { invoiceNumber: 'Y' } }]));
    const create = vi.spyOn(draftService, 'create').mockResolvedValue({} as never);
    expect(await importBrowserDrafts('invoice')).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
    localStorage.setItem(IMPORTER_KEY, '{not json');
    expect(await importBrowserDrafts('importer')).toBe(0);
  });

  it('leaves out a date it cannot read', async () => {
    localStorage.setItem(INVOICE_KEY, JSON.stringify([{ id: 'x', createdAt: 'yesterday', data: { invoiceNumber: 'Z' } }]));
    const create = vi.spyOn(draftService, 'create').mockResolvedValue({} as never);
    await importBrowserDrafts('invoice');
    expect(create).toHaveBeenCalledWith('invoice', { invoiceNumber: 'Z' }, undefined);
  });
});

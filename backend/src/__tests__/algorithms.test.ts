import { lastAtOrBefore } from '../utils/binarySearch';
import { topN } from '../utils/topN';
import { prismaMock } from './setup';
import { invoiceService } from '../services/invoice.service';

describe('lastAtOrBefore (binary search)', () => {
  const series = [{ t: 10 }, { t: 20 }, { t: 20 }, { t: 40 }];
  const key = (r: { t: number }) => r.t;
  it('finds the last item at or before the target', () => {
    expect(lastAtOrBefore(series, 25, key)).toBe(2);
    expect(lastAtOrBefore(series, 40, key)).toBe(3);
    expect(lastAtOrBefore(series, 10, key)).toBe(0);
  });
  it('returns -1 when everything is later, or the list is empty', () => {
    expect(lastAtOrBefore(series, 9, key)).toBe(-1);
    expect(lastAtOrBefore([], 5, key)).toBe(-1);
  });
  it('agrees with a plain scan on random data', () => {
    const sorted = Array.from({ length: 200 }, () => Math.floor(Math.random() * 1000)).sort((a, b) => a - b).map((t) => ({ t }));
    for (let target = -5; target < 1005; target += 7) {
      let expected = -1;
      sorted.forEach((r, i) => { if (r.t <= target) expected = i; });
      expect(lastAtOrBefore(sorted, target, key)).toBe(expected);
    }
  });
});

describe('topN (min-heap)', () => {
  it('returns the n largest, best first', () => {
    expect(topN([5, 1, 9, 3, 7, 8, 2], 3, (x) => x)).toEqual([9, 8, 7]);
  });
  it('handles fewer items than n, n of zero and ties', () => {
    expect(topN([2, 1], 5, (x) => x)).toEqual([2, 1]);
    expect(topN([2, 1], 0, (x) => x)).toEqual([]);
    expect(topN([4, 4, 4, 1], 2, (x) => x)).toEqual([4, 4]);
  });
  it('agrees with sorting everything on random data', () => {
    const items = Array.from({ length: 300 }, () => Math.random());
    expect(topN(items, 5, (x) => x)).toEqual([...items].sort((a, b) => b - a).slice(0, 5));
  });
});

describe('invoiceService bulk helpers', () => {
  it('softDeleteMany deletes live invoices and their hidden pages in one transaction, and reports unknown ids', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as never);
    prismaMock.$transaction.mockResolvedValue([] as never);
    const result = await invoiceService.softDeleteMany(['a', 'x', 'b']);
    expect(result).toEqual({ deleted: ['a', 'b'], missing: ['x'] });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.invoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ counterpartOfId: { in: ['a', 'b'] }, isCompanion: true }) }));
  });
  it('getManyWithCompanions keeps the order given and fails when an invoice is missing', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'b', invoiceKind: 'NORMAL' }, { id: 'a', invoiceKind: 'NORMAL' }] as never);
    const rows = await invoiceService.getManyWithCompanions(['a', 'b']);
    expect(rows.map((r) => r.invoice.id)).toEqual(['a', 'b']);
    await expect(invoiceService.getManyWithCompanions(['a', 'zzz'])).rejects.toThrow('Invoice not found');
  });
});

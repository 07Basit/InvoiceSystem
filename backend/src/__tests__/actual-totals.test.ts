import { prismaMock } from './setup';

jest.mock('../services/currency.service', () => ({
  currencyService: {
    buildConverter: jest.fn(async () => ({ baseCurrency: 'INR', convert: () => 100, convertDetailed: () => null })),
  },
}));

import { invoiceService } from '../services/invoice.service';
import { getDashboardStats } from '../controllers/dashboard.controller';

describe('actual invoices are left out of totals (nothing counted twice)', () => {
  it('the Invoices page summary only counts invoices that are not actual copies', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    await invoiceService.summary();
    expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, actualOfId: null, counterpartOfId: null } }));
  });

  it('the dashboard totals, monthly chart and per-importer revenue use only originals, while the recent list shows everything', async () => {
    prismaMock.importer.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    await new Promise<void>((resolve) => {
      const res = { json: () => resolve(), status: () => res } as never;
      void (getDashboardStats as unknown as (req: unknown, res: unknown, next: (e?: unknown) => void) => void)({}, res, () => resolve());
    });

    const calls = prismaMock.invoice.findMany.mock.calls.map((c) => c[0] as { where: Record<string, unknown>; take?: number });
    const totals = calls.find((c) => c.take === undefined)!;
    const recent = calls.find((c) => c.take === 8)!;
    expect(totals.where).toEqual({ deletedAt: null, actualOfId: null, counterpartOfId: null });
    expect(recent.where).toEqual({ deletedAt: null });
  });
});

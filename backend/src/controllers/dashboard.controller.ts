import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { currencyService } from '../services/currency.service';
import { topN } from '../utils/topN';

const MONTHS_BACK = 12;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const [importers, invoices, recentInvoices] = await Promise.all([
    prisma.importer.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, buyerName: true, currency: true, createdAt: true },
    }),
    // The database adds up invoices that share importer, day, currency and manual rate (one rate applies to all of
    // them), so far fewer rows come back than there are invoices.
    prisma.invoice.groupBy({
      by: ['importerId', 'invoiceDate', 'currency', 'manualRate', 'manualRateBase'],
      // an "actual" invoice is a copy of an original, so it is left out of every total (nothing counted twice)
      where: { deletedAt: null, actualOfId: null, counterpartOfId: null },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.invoice.findMany({
      where: { deletedAt: null, isCompanion: false },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true, invoiceNumber: true, invoiceDate: true, total: true, currency: true, createdAt: true, manualRate: true, manualRateBase: true,
        importerName: true,
        importer: { select: { name: true } },
      },
    }),
  ]);

  // Everything is reported in the base currency, valued at the exchange rate of each invoice's
  // own date. Invoices with no available rate still count as invoices, are left out of revenue
  // and flagged via `missingRates`.
  const groups = invoices.map((g) => ({
    importerId: g.importerId,
    invoiceDate: g.invoiceDate,
    currency: g.currency,
    manualRate: g.manualRate,
    manualRateBase: g.manualRateBase,
    total: g._sum.total ?? 0,
    count: g._count._all,
  }));
  const { baseCurrency: currency, convert } = await currencyService.buildConverter(groups);
  const missing = new Map<string, number>(); // currency -> number of invoices that couldn't be converted
  const converted = groups.map((inv) => {
    const base = convert(inv);
    if (base === null) missing.set(inv.currency, (missing.get(inv.currency) ?? 0) + inv.count);
    return { ...inv, base };
  });

  const now = new Date();
  const monthly = new Map<string, { month: string; revenue: number; invoices: number }>();
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthly.set(monthKey(d), { month: monthKey(d), revenue: 0, invoices: 0 });
  }
  for (const inv of converted) {
    const bucket = monthly.get(monthKey(new Date(inv.invoiceDate)));
    if (!bucket) continue;
    bucket.invoices += inv.count;
    bucket.revenue += inv.base ?? 0;
  }

  const perImporter = new Map<string, { revenue: number; invoiceCount: number }>();
  for (const inv of converted) {
    const e = perImporter.get(inv.importerId) ?? { revenue: 0, invoiceCount: 0 };
    e.invoiceCount += inv.count;
    e.revenue += inv.base ?? 0;
    perImporter.set(inv.importerId, e);
  }

  const importerList = importers.map((imp) => ({
    ...imp,
    invoiceCount: perImporter.get(imp.id)?.invoiceCount ?? 0,
    revenue: perImporter.get(imp.id)?.revenue ?? 0,
  }));

  const stats = {
    currency,
    missingRates: [...missing.keys()].sort(),
    excludedInvoices: [...missing.values()].reduce((a, b) => a + b, 0),
    overview: {
      totalRevenue: converted.reduce((s, i) => s + (i.base ?? 0), 0),
      totalInvoices: converted.reduce((s, i) => s + i.count, 0),
      totalImporters: importers.length,
    },
    monthly: [...monthly.values()],
    topImporters: topN(importerList, 5, (i) => i.revenue).filter((i) => i.revenue > 0),
    recentInvoices: recentInvoices.map((inv) => ({
      ...inv,
      // true when no exchange rate is available, so the invoice is left out of revenue
      excludedFromRevenue: convert(inv) === null,
    })),
    importers: importerList.slice(0, 8),
  };

  logger.info('Dashboard stats fetched');
  res.json({ success: true, data: stats, error: null, meta: null });
});

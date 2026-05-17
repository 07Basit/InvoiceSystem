import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const [
    totalInvoices,
    totalImporters,
    paidInvoices,
    pendingInvoices,
    overdueInvoices,
    recentInvoices,
    topImporters,
  ] = await Promise.all([
    prisma.invoice.count({ where: { deletedAt: null } }),
    prisma.importer.count({ where: { deletedAt: null } }),
    prisma.invoice.aggregate({
      where: { status: 'PAID', deletedAt: null },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.count({ where: { status: { in: ['DRAFT', 'SENT'] }, deletedAt: null } }),
    prisma.invoice.count({ where: { status: 'OVERDUE', deletedAt: null } }),
    prisma.invoice.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, invoiceNumber: true, status: true, total: true, createdAt: true,
        importer: { select: { name: true } },
      },
    }),
    prisma.importer.findMany({
      where: { deletedAt: null },
      take: 5,
      include: {
        invoices: {
          where: { status: 'PAID', deletedAt: null },
          select: { total: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const topImportersSorted = topImporters
    .map((c) => ({
      id: c.id,
      name: c.name,
      totalPaid: c.invoices.reduce((sum, inv) => sum + Number(inv.total), 0),
      invoiceCount: c.invoices.length,
    }))
    .sort((a, b) => b.totalPaid - a.totalPaid);

  const stats = {
    overview: {
      totalInvoices,
      totalImporters,
      totalRevenue: Number(paidInvoices._sum.total ?? 0),
      paidInvoicesCount: paidInvoices._count,
      pendingInvoicesCount: pendingInvoices,
      overdueInvoicesCount: overdueInvoices,
    },
    recentInvoices,
    topImporters: topImportersSorted,
  };

  logger.info('Dashboard stats fetched');
  res.json({ success: true, data: stats, error: null, meta: null });
});

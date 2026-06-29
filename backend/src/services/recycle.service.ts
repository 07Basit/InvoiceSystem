import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

type RecordType = 'invoice' | 'importer';

export const recycleService = {
  async listDeleted() {
    const [invoices, importers] = await Promise.all([
      prisma.invoice.findMany({
        where: { deletedAt: { not: null } },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          total: true,
          currency: true,
          deletedAt: true,
          createdAt: true,
          importer: { select: { name: true } },
        },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.importer.findMany({
        where: { deletedAt: { not: null } },
        select: {
          id: true,
          name: true,
          buyerName: true,
          contact: true,
          email: true,
          currency: true,
          deletedAt: true,
          createdAt: true,
        },
        orderBy: { deletedAt: 'desc' },
      }),
    ]);

    return { invoices, importers };
  },

  async restore(type: RecordType, id: string) {
    if (type === 'invoice') {
      const record = await prisma.invoice.findFirst({ where: { id, deletedAt: { not: null } } });
      if (!record) throw new AppError('Deleted invoice not found', 404, 'NOT_FOUND');
      return prisma.invoice.update({ where: { id }, data: { deletedAt: null } });
    }

    if (type === 'importer') {
      const record = await prisma.importer.findFirst({ where: { id, deletedAt: { not: null } } });
      if (!record) throw new AppError('Deleted importer not found', 404, 'NOT_FOUND');
      return prisma.importer.update({ where: { id }, data: { deletedAt: null } });
    }
  },

  async permanentDelete(type: RecordType, id: string) {
    if (type === 'invoice') {
      const record = await prisma.invoice.findFirst({ where: { id, deletedAt: { not: null } } });
      if (!record) throw new AppError('Deleted invoice not found', 404, 'NOT_FOUND');
      // Delete line items first (child records), then the invoice
      await prisma.$transaction([
        prisma.lineItem.deleteMany({ where: { invoiceId: id } }),
        prisma.invoice.delete({ where: { id } }),
      ]);
      return;
    }

    if (type === 'importer') {
      const record = await prisma.importer.findFirst({ where: { id, deletedAt: { not: null } } });
      if (!record) throw new AppError('Deleted importer not found', 404, 'NOT_FOUND');
      // Null out FK references in invoices before deleting importer
      await prisma.$transaction([
        prisma.invoice.updateMany({
          where: { importerId: id },
          data: { landingLocationId: null, loadingLocationId: null },
        }),
        prisma.invoice.deleteMany({ where: { importerId: id } }),
        prisma.landingLocation.deleteMany({ where: { importerId: id } }),
        prisma.loadingLocation.deleteMany({ where: { importerId: id } }),
        prisma.importer.delete({ where: { id } }),
      ]);
    }
  },
};

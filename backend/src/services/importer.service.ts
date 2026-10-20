import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { CreateImporterDto, ListImportersQuery, PaginationMeta, UpdateImporterDto } from 'shared';
import { containsCi } from '../utils/caseInsensitive';

const importerInclude = {
  landingLocations: true,
  loadingLocations: true,
  _count: { select: { invoices: { where: { deletedAt: null, isCompanion: false } } } },
} as const;

export const importerService = {
  async list(query: ListImportersQuery): Promise<{ data: unknown[]; meta: PaginationMeta }> {
    const page = Number.isFinite(Number(query.page)) ? Math.max(1, Math.floor(Number(query.page))) : 1;
    const limit = Number.isFinite(Number(query.limit)) ? Math.min(100, Math.max(1, Math.floor(Number(query.limit)))) : 20;
    const search = query.search;
    const sort = query.sort === 'buyerName' || query.sort === 'createdAt' ? query.sort : 'name';
    const order = query.order === 'desc' ? 'desc' : 'asc';
    const status = query.status === 'active' || query.status === 'inactive' ? query.status : 'all';

    // Every word typed has to match somewhere (name, buyer, contact, address, currency, ports or countries).
    const terms = (search ?? '').split(/\s+/).filter(Boolean);
    const matchesTerm = (term: string): Prisma.ImporterWhereInput => ({
      OR: [
        { name: containsCi(term) },
        { buyerName: containsCi(term) },
        { contact: containsCi(term) },
        { email: containsCi(term) },
        { address: containsCi(term) },
        { currency: containsCi(term) },
        { landingLocations: { some: { OR: [
          { name: containsCi(term) }, { portOfDischarge: containsCi(term) },
          { finalDestination: containsCi(term) }, { countryOfDestination: containsCi(term) },
        ] } } },
        { loadingLocations: { some: { OR: [
          { name: containsCi(term) }, { portOfLoading: containsCi(term) }, { countryOfOrigin: containsCi(term) },
        ] } } },
      ],
    });

    const where: Prisma.ImporterWhereInput = {
      deletedAt: null,
      ...(status === 'active' ? { isActive: true } : {}),
      ...(status === 'inactive' ? { isActive: false } : {}),
      ...(terms.length ? { AND: terms.map(matchesTerm) } : {}),
    };

    const [importers, total] = await prisma.$transaction([
      prisma.importer.findMany({
        where,
        include: importerInclude,
        // active importers first, then the chosen order; id keeps the order stable between pages
        orderBy: [{ isActive: 'desc' }, { [sort]: order }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.importer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: importers,
      meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  },

  /** Headline counts for the Importers page. */
  async summary() {
    const [total, active] = await Promise.all([
      prisma.importer.count({ where: { deletedAt: null } }),
      prisma.importer.count({ where: { deletedAt: null, isActive: true } }),
    ]);
    return { total, active, inactive: total - active };
  },

  async getById(id: string) {
    const importer = await prisma.importer.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...importerInclude,
        invoices: {
          where: { deletedAt: null, isCompanion: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, invoiceNumber: true, total: true, createdAt: true },
        },
      },
    });

    if (!importer) {
      throw new AppError('Importer not found', 404, 'IMPORTER_NOT_FOUND');
    }

    return importer;
  },

  async create(dto: CreateImporterDto) {
    const landingLocations = dto.landingLocations.map((item) => ({
      name: item.name,
      portOfDischarge: item.portOfDischarge,
      finalDestination: item.finalDestination,
      countryOfDestination: item.countryOfDestination,
    }));

    const loadingLocations = dto.loadingLocations.map((item) => ({
      name: item.name,
      portOfLoading: item.portOfLoading,
      countryOfOrigin: item.countryOfOrigin,
    }));

    return prisma.importer.create({
      data: {
        name: dto.name,
        address: dto.address,
        contact: dto.contact || null,
        email: dto.email ?? null,
        buyerName: dto.buyerName || null,
        currency: dto.currency,
        landingLocations: { create: landingLocations },
        loadingLocations: { create: loadingLocations },
      },
      include: importerInclude,
    });
  },

  async update(id: string, dto: UpdateImporterDto) {
    await this.getById(id);

    return prisma.$transaction(async (tx) => {
      // Invoices keep their own copy of every port/country value, so they never depend on these rows.
      // Detach the links first: otherwise the database refuses to delete a location an invoice points at.
      if (dto.landingLocations) {
        await tx.invoice.updateMany({ where: { importerId: id }, data: { landingLocationId: null } });
        await tx.landingLocation.deleteMany({ where: { importerId: id } });
      }

      if (dto.loadingLocations) {
        await tx.invoice.updateMany({ where: { importerId: id }, data: { loadingLocationId: null } });
        await tx.loadingLocation.deleteMany({ where: { importerId: id } });
      }

      return tx.importer.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.contact !== undefined ? { contact: dto.contact || null } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.buyerName !== undefined ? { buyerName: dto.buyerName || null } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.landingLocations
            ? {
                landingLocations: {
                  create: dto.landingLocations.map((item) => ({
                    name: item.name,
                    portOfDischarge: item.portOfDischarge,
                    finalDestination: item.finalDestination,
                    countryOfDestination: item.countryOfDestination,
                  })),
                },
              }
            : {}),
          ...(dto.loadingLocations
            ? {
                loadingLocations: {
                  create: dto.loadingLocations.map((item) => ({
                    name: item.name,
                    portOfLoading: item.portOfLoading,
                    countryOfOrigin: item.countryOfOrigin,
                  })),
                },
              }
            : {}),
        },
        include: importerInclude,
      });
    });
  },

  async softDelete(id: string) {
    await this.getById(id);
    return prisma.importer.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};

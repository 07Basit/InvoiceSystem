import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { CreateImporterDto, ListImportersQuery, PaginationMeta, UpdateImporterDto } from 'shared';

const importerInclude = {
  landingLocations: true,
  loadingLocations: true,
  _count: { select: { invoices: { where: { deletedAt: null } } } },
} as const;

export const importerService = {
  async list(query: ListImportersQuery): Promise<{ data: unknown[]; meta: PaginationMeta }> {
    const page = Number.isFinite(Number(query.page)) ? Math.max(1, Math.floor(Number(query.page))) : 1;
    const limit = Number.isFinite(Number(query.limit)) ? Math.min(100, Math.max(1, Math.floor(Number(query.limit)))) : 20;
    const search = query.search;
    const sort = query.sort === 'buyerName' || query.sort === 'createdAt' ? query.sort : 'name';
    const order = query.order === 'asc' ? 'asc' : 'desc';

    const where: Prisma.ImporterWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { buyerName: { contains: search, mode: 'insensitive' } },
              { contact: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [importers, total] = await prisma.$transaction([
      prisma.importer.findMany({
        where,
        include: importerInclude,
        orderBy: { [sort]: order },
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

  async getById(id: string) {
    const importer = await prisma.importer.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...importerInclude,
        invoices: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, invoiceNumber: true, status: true, total: true, createdAt: true },
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
        contact: dto.contact,
        email: dto.email ?? null,
        buyerName: dto.buyerName,
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
      if (dto.landingLocations) {
        await tx.landingLocation.deleteMany({ where: { importerId: id } });
      }

      if (dto.loadingLocations) {
        await tx.loadingLocation.deleteMany({ where: { importerId: id } });
      }

      return tx.importer.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.contact !== undefined ? { contact: dto.contact } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.buyerName !== undefined ? { buyerName: dto.buyerName } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
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

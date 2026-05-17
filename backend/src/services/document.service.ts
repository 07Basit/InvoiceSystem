import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { PaginationMeta } from 'shared';
import type { CreateDocumentDto, UpdateDocumentDto, ListDocumentsQuery } from 'shared';

export const documentService = {
  async list(query: ListDocumentsQuery): Promise<{ data: unknown[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search;
    const sort = query.sort ?? 'updatedAt';
    const order = query.order ?? 'desc';
    const type = query.type;

    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
      ...(type && { type }),
      ...(search && {
        OR: [{ title: { contains: search, mode: 'insensitive' } }],
      }),
    };

    const [documents, total] = await prisma.$transaction([
      prisma.document.findMany({
        where,
        select: { id: true, title: true, type: true, createdAt: true, updatedAt: true },
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: documents,
      meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  },

  async getById(id: string) {
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    return doc;
  },

  async create(dto: CreateDocumentDto) {
    return prisma.document.create({ data: { title: dto.title, type: dto.type, content: dto.content ?? '' } });
  },

  async update(id: string, dto: UpdateDocumentDto) {
    await this.getById(id);
    return prisma.document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
      },
    });
  },

  async softDelete(id: string) {
    await this.getById(id);
    return prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};

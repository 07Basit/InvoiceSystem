import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { ProductListDto } from 'shared';
import { ci } from '../utils/caseInsensitive';

async function getOrThrow(id: string) {
  const list = await prisma.productList.findUnique({ where: { id } });
  if (!list) throw new AppError('Product list not found', 404, 'PRODUCT_LIST_NOT_FOUND');
  return list;
}

const sameList = (dto: ProductListDto) => ({ importerId: dto.importerId, currency: dto.currency, locationName: dto.locationName ? ci(dto.locationName) : null });
const newList = (dto: ProductListDto) => ({ importerId: dto.importerId, currency: dto.currency, locationName: dto.locationName ?? null });

export const productListService = {
  /** Newest first. */
  async list() {
    return prisma.productList.findMany({ orderBy: { createdAt: 'desc' } });
  },

  async create(dto: ProductListDto) {
    if (!(await prisma.importer.findUnique({ where: { id: dto.importerId }, select: { id: true } }))) {
      throw new AppError('Importer not found', 404, 'IMPORTER_NOT_FOUND');
    }
    const twin = await prisma.productList.findFirst({ where: sameList(dto), select: { id: true } });
    if (twin) throw new AppError('This list already exists', 409, 'PRODUCT_LIST_EXISTS');
    return prisma.productList.create({ data: newList(dto) });
  },

  /** Makes sure the list exists (used when a product is added to it from an invoice); never fails for an existing one. */
  async ensure(dto: ProductListDto) {
    const existing = await prisma.productList.findFirst({ where: sameList(dto), select: { id: true } });
    if (!existing) await prisma.productList.create({ data: newList(dto) });
  },

  /** Deleting a list deletes its products too. Invoices keep their own copy of product names. */
  async remove(id: string) {
    const list = await getOrThrow(id);
    await prisma.$transaction([
      prisma.product.deleteMany({ where: { importerId: list.importerId, currency: list.currency, locationName: list.locationName } }),
      prisma.productList.delete({ where: { id } }),
    ]);
  },
};

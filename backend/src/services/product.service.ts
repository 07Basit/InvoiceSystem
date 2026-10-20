import { prisma } from '../lib/prisma';
import { productListService } from './product-list.service';
import { AppError } from '../utils/AppError';
import type { ProductDto } from 'shared';
import { ci } from '../utils/caseInsensitive';

const fields = (dto: ProductDto) => ({
  name: dto.name,
  importerId: dto.importerId ?? null,
  currency: dto.currency ?? null,
  locationName: dto.locationName ?? null,
  nettWeightPerPackage: dto.nettWeightPerPackage ?? null,
  ratePerKg: dto.ratePerKg ?? null,
  hsCode: dto.hsCode || null,
});

async function getOrThrow(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
  return product;
}

/** A name can appear once in each list (the general list, or one importer + currency + location). Capitals are ignored. */
async function assertNameFree(dto: ProductDto, exceptId?: string) {
  const twin = await prisma.product.findFirst({
    where: {
      name: ci(dto.name),
      importerId: dto.importerId ?? null,
      currency: dto.currency ?? null,
      locationName: dto.locationName ? ci(dto.locationName) : null,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (twin) throw new AppError(`"${dto.name}" is already in this list`, 409, 'PRODUCT_EXISTS');
}

async function assertImporterExists(importerId: string | undefined) {
  if (importerId && !(await prisma.importer.findUnique({ where: { id: importerId }, select: { id: true } }))) {
    throw new AppError('Importer not found', 404, 'IMPORTER_NOT_FOUND');
  }
}

export const productService = {
  /** Alphabetical, so the dropdown reads like a catalogue. */
  async list() {
    return prisma.product.findMany({ orderBy: { name: 'asc' } });
  },

  async create(dto: ProductDto) {
    await assertImporterExists(dto.importerId);
    await assertNameFree(dto);
    // a product added to an importer's list (even from an invoice) makes sure that list exists
    if (dto.importerId && dto.currency) await productListService.ensure({ importerId: dto.importerId, currency: dto.currency, ...(dto.locationName ? { locationName: dto.locationName } : {}) });
    return prisma.product.create({ data: fields(dto) });
  },

  async update(id: string, dto: ProductDto) {
    await getOrThrow(id);
    await assertImporterExists(dto.importerId);
    await assertNameFree(dto, id);
    return prisma.product.update({ where: { id }, data: fields(dto) });
  },

  /** "Not needed" products stay saved but are not offered on new invoices. */
  async setActive(id: string, isActive: boolean) {
    await getOrThrow(id);
    return prisma.product.update({ where: { id }, data: { isActive } });
  },

  /** Invoice lines keep their own copy of the name, so deleting a product never changes an invoice. */
  async remove(id: string) {
    await getOrThrow(id);
    await prisma.product.delete({ where: { id } });
  },
};

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { ProductDto } from 'shared';

const fields = (dto: ProductDto) => ({
  name: dto.name,
  nettWeightPerPackage: dto.nettWeightPerPackage ?? null,
  ratePerKg: dto.ratePerKg ?? null,
  hsCode: dto.hsCode || null,
});

async function getOrThrow(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
  return product;
}

/** The name column is unique (ignoring capitals), so a duplicate surfaces as a friendly 409. */
function asDuplicate(error: unknown, name: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError(`"${name}" is already in your products`, 409, 'PRODUCT_EXISTS');
  }
  throw error;
}

export const productService = {
  /** Alphabetical, so the dropdown reads like a catalogue. */
  async list() {
    return prisma.product.findMany({ orderBy: { name: 'asc' } });
  },

  async create(dto: ProductDto) {
    try {
      return await prisma.product.create({ data: fields(dto) });
    } catch (error) {
      return asDuplicate(error, dto.name);
    }
  },

  async update(id: string, dto: ProductDto) {
    await getOrThrow(id);
    try {
      return await prisma.product.update({ where: { id }, data: fields(dto) });
    } catch (error) {
      return asDuplicate(error, dto.name);
    }
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

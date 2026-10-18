import { Prisma } from '@prisma/client';
import { prismaMock } from './setup';
import { productService } from '../services/product.service';
import { productSchema } from 'shared';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1', name: 'Alphonso Mango', nettWeightPerPackage: null, ratePerKg: null, hsCode: null, isActive: true,
  createdAt: new Date('2026-10-18T00:00:00Z'), updatedAt: new Date('2026-10-18T00:00:00Z'), ...over,
});
const duplicate = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'x' });

describe('productSchema', () => {
  it('needs a name, and usual values must be above zero when given', () => {
    expect(productSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(productSchema.safeParse({ name: 'Banana', ratePerKg: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ name: 'Banana', nettWeightPerPackage: -1 }).success).toBe(false);
    expect(productSchema.parse({ name: ' Banana ', nettWeightPerPackage: 12, ratePerKg: 2.5 })).toEqual({ name: 'Banana', nettWeightPerPackage: 12, ratePerKg: 2.5 });
  });
});

describe('productService', () => {
  it('lists products alphabetically', async () => {
    prismaMock.product.findMany.mockResolvedValue([row()] as never);
    await productService.list();
    expect(prismaMock.product.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });

  it('saves blanks as null', async () => {
    prismaMock.product.create.mockResolvedValue(row() as never);
    await productService.create({ name: 'Alphonso Mango', hsCode: '' });
    expect(prismaMock.product.create).toHaveBeenCalledWith({ data: { name: 'Alphonso Mango', nettWeightPerPackage: null, ratePerKg: null, hsCode: null } });
  });

  it('refuses a duplicate name with a friendly 409', async () => {
    prismaMock.product.create.mockRejectedValue(duplicate());
    await expect(productService.create({ name: 'Alphonso Mango' })).rejects.toMatchObject({ statusCode: 409, code: 'PRODUCT_EXISTS' });
  });

  it('refuses renaming onto another product', async () => {
    prismaMock.product.findUnique.mockResolvedValue(row() as never);
    prismaMock.product.update.mockRejectedValue(duplicate());
    await expect(productService.update('p1', { name: 'Banana' })).rejects.toMatchObject({ code: 'PRODUCT_EXISTS' });
  });

  it('404s for an unknown product', async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);
    await expect(productService.update('nope', { name: 'X' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(productService.setActive('nope', false)).rejects.toMatchObject({ statusCode: 404 });
    await expect(productService.remove('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('marks a product as not needed and deletes it', async () => {
    prismaMock.product.findUnique.mockResolvedValue(row() as never);
    prismaMock.product.update.mockResolvedValue(row({ isActive: false }) as never);
    await productService.setActive('p1', false);
    expect(prismaMock.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isActive: false } });
    await productService.remove('p1');
    expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });
});

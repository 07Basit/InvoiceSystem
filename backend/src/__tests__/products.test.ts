import { prismaMock } from './setup';
import { productService } from '../services/product.service';
import { productSchema } from 'shared';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1', name: 'Alphonso Mango', importerId: null, currency: null, locationName: null, nettWeightPerPackage: null, ratePerKg: null, hsCode: null, isActive: true,
  createdAt: new Date('2026-10-18T00:00:00Z'), updatedAt: new Date('2026-10-18T00:00:00Z'), ...over,
});

describe('productSchema', () => {
  it('needs a name, and usual values must be above zero when given', () => {
    expect(productSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(productSchema.safeParse({ name: 'Banana', ratePerKg: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ name: 'Banana', nettWeightPerPackage: -1 }).success).toBe(false);
    expect(productSchema.parse({ name: ' Banana ', nettWeightPerPackage: 12, ratePerKg: 2.5 })).toEqual({ name: 'Banana', nettWeightPerPackage: 12, ratePerKg: 2.5 });
  });

  it('keeps an importer, currency and location together', () => {
    expect(productSchema.parse({ name: 'Banana', importerId: 'i1', currency: 'cad', locationName: ' Toronto ' })).toEqual({ name: 'Banana', importerId: 'i1', currency: 'CAD', locationName: 'Toronto' });
    expect(productSchema.safeParse({ name: 'Banana', currency: 'CAD' }).success).toBe(false);
    expect(productSchema.safeParse({ name: 'Banana', locationName: 'Toronto' }).success).toBe(false);
    expect(productSchema.safeParse({ name: 'Banana', importerId: 'i1', locationName: 'Toronto' }).success).toBe(false);
    expect(productSchema.safeParse({ name: 'Banana', importerId: 'i1' }).success).toBe(true);
  });
});

describe('productService', () => {
  it('lists products alphabetically', async () => {
    prismaMock.product.findMany.mockResolvedValue([row()] as never);
    await productService.list();
    expect(prismaMock.product.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });

  it('saves blanks as null (a general product)', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue(row() as never);
    await productService.create({ name: 'Alphonso Mango', hsCode: '' });
    expect(prismaMock.product.create).toHaveBeenCalledWith({
      data: { name: 'Alphonso Mango', importerId: null, currency: null, locationName: null, nettWeightPerPackage: null, ratePerKg: null, hsCode: null },
    });
  });

  it('saves a product for an importer, currency and location', async () => {
    prismaMock.importer.findUnique.mockResolvedValue({ id: 'i1' } as never);
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue(row() as never);
    await productService.create({ name: 'Banana', importerId: 'i1', currency: 'CAD', locationName: 'Toronto', ratePerKg: 2.5 });
    expect(prismaMock.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ importerId: 'i1', currency: 'CAD', locationName: 'Toronto', ratePerKg: 2.5 }),
    });
  });

  it('allows the same name in another list, but not twice in the same one', async () => {
    prismaMock.product.findFirst.mockResolvedValueOnce(row() as never);
    await expect(productService.create({ name: 'Alphonso Mango' })).rejects.toMatchObject({ statusCode: 409, code: 'PRODUCT_EXISTS' });
    expect(prismaMock.product.findFirst).toHaveBeenCalledWith({ where: { name: { equals: 'Alphonso Mango', mode: 'insensitive' }, importerId: null, currency: null, locationName: null }, select: { id: true } });
    prismaMock.importer.findUnique.mockResolvedValue({ id: 'i1' } as never);
    prismaMock.product.findFirst.mockResolvedValueOnce(null);
    prismaMock.product.create.mockResolvedValue(row() as never);
    await expect(productService.create({ name: 'Alphonso Mango', importerId: 'i1' })).resolves.toBeDefined();
  });

  it('refuses an unknown importer', async () => {
    prismaMock.importer.findUnique.mockResolvedValue(null);
    await expect(productService.create({ name: 'Banana', importerId: 'nope' })).rejects.toMatchObject({ statusCode: 404, code: 'IMPORTER_NOT_FOUND' });
  });

  it('refuses renaming onto another product in the same list, ignoring itself', async () => {
    prismaMock.product.findUnique.mockResolvedValue(row() as never);
    prismaMock.product.findFirst.mockResolvedValueOnce(row({ id: 'p2' }) as never);
    await expect(productService.update('p1', { name: 'Banana' })).rejects.toMatchObject({ code: 'PRODUCT_EXISTS' });
    expect(prismaMock.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ NOT: { id: 'p1' } }) }));
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

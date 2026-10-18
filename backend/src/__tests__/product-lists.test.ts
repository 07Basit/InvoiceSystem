import { prismaMock } from './setup';
import { productListService } from '../services/product-list.service';
import { productService } from '../services/product.service';
import { productListSchema } from 'shared';

const list = (over: Record<string, unknown> = {}) => ({ id: 'l1', importerId: 'i1', currency: 'CAD', locationName: null, createdAt: new Date(), ...over });

describe('productListSchema', () => {
  it('needs an importer and a currency; the location is optional', () => {
    expect(productListSchema.safeParse({ importerId: '', currency: 'CAD' }).success).toBe(false);
    expect(productListSchema.safeParse({ importerId: 'i1', currency: '' }).success).toBe(false);
    expect(productListSchema.parse({ importerId: 'i1', currency: 'cad', locationName: ' Toronto ' })).toEqual({ importerId: 'i1', currency: 'CAD', locationName: 'Toronto' });
    expect(productListSchema.safeParse({ importerId: 'i1', currency: 'CAD' }).success).toBe(true);
  });
});

describe('productListService', () => {
  it('creates a list for an importer, currency and location', async () => {
    prismaMock.importer.findUnique.mockResolvedValue({ id: 'i1' } as never);
    prismaMock.productList.findFirst.mockResolvedValue(null);
    prismaMock.productList.create.mockResolvedValue(list() as never);
    await productListService.create({ importerId: 'i1', currency: 'CAD', locationName: 'Toronto' });
    expect(prismaMock.productList.create).toHaveBeenCalledWith({ data: { importerId: 'i1', currency: 'CAD', locationName: 'Toronto' } });
  });

  it('refuses an unknown importer and a list that already exists', async () => {
    prismaMock.importer.findUnique.mockResolvedValueOnce(null);
    await expect(productListService.create({ importerId: 'nope', currency: 'CAD' })).rejects.toMatchObject({ statusCode: 404, code: 'IMPORTER_NOT_FOUND' });
    prismaMock.importer.findUnique.mockResolvedValue({ id: 'i1' } as never);
    prismaMock.productList.findFirst.mockResolvedValue(list() as never);
    await expect(productListService.create({ importerId: 'i1', currency: 'CAD' })).rejects.toMatchObject({ statusCode: 409, code: 'PRODUCT_LIST_EXISTS' });
  });

  it('deletes a list together with its products', async () => {
    prismaMock.productList.findUnique.mockResolvedValue(list({ locationName: 'Toronto' }) as never);
    prismaMock.$transaction.mockResolvedValue([] as never);
    await productListService.remove('l1');
    expect(prismaMock.product.deleteMany).toHaveBeenCalledWith({ where: { importerId: 'i1', currency: 'CAD', locationName: 'Toronto' } });
    expect(prismaMock.productList.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
  });

  it('404s for an unknown list', async () => {
    prismaMock.productList.findUnique.mockResolvedValue(null);
    await expect(productListService.remove('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('adding a product to an importer list creates the list when it is missing', async () => {
    prismaMock.importer.findUnique.mockResolvedValue({ id: 'i1' } as never);
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.productList.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({ id: 'p1' } as never);
    await productService.create({ name: 'Banana', importerId: 'i1', currency: 'CAD' });
    expect(prismaMock.productList.create).toHaveBeenCalledWith({ data: { importerId: 'i1', currency: 'CAD', locationName: null } });
  });

  it('does not create a list again, nor for a general product', async () => {
    prismaMock.importer.findUnique.mockResolvedValue({ id: 'i1' } as never);
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({ id: 'p1' } as never);
    prismaMock.productList.findFirst.mockResolvedValue(list() as never);
    await productService.create({ name: 'Banana', importerId: 'i1', currency: 'CAD' });
    await productService.create({ name: 'Mango' });
    expect(prismaMock.productList.create).not.toHaveBeenCalled();
  });
});

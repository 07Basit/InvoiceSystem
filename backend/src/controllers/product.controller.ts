import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { productService } from '../services/product.service';
import type { ProductDto } from 'shared';

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, error: null, meta: null });

export const listProducts = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await productService.list());
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.create(req.body as ProductDto);
  logger.info('Product created', { productId: product.id, action: 'create_product' });
  ok(res, product, 201);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.update(String(req.params.id), req.body as ProductDto);
  logger.info('Product updated', { productId: product.id, action: 'update_product' });
  ok(res, product);
});

export const setProductActive = asyncHandler(async (req: Request, res: Response) => {
  const isActive = Boolean((req.body as { isActive?: unknown }).isActive);
  const product = await productService.setActive(String(req.params.id), isActive);
  logger.info('Product availability changed', { productId: product.id, isActive, action: 'toggle_product' });
  ok(res, product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await productService.remove(String(req.params.id));
  logger.info('Product deleted', { productId: String(req.params.id), action: 'delete_product' });
  ok(res, null);
});

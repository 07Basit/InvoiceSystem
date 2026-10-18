import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { productListService } from '../services/product-list.service';
import type { ProductListDto } from 'shared';

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, error: null, meta: null });

export const listProductLists = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await productListService.list());
});

export const createProductList = asyncHandler(async (req: Request, res: Response) => {
  const list = await productListService.create(req.body as ProductListDto);
  logger.info('Product list created', { listId: list.id, action: 'create_product_list' });
  ok(res, list, 201);
});

export const deleteProductList = asyncHandler(async (req: Request, res: Response) => {
  await productListService.remove(String(req.params.id));
  logger.info('Product list deleted', { listId: String(req.params.id), action: 'delete_product_list' });
  ok(res, null);
});

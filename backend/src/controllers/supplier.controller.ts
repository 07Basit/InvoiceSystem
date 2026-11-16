import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { supplierService } from '../services/supplier.service';
import type { SupplierDto } from 'shared';

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data, error: null, meta: null });

export const listSuppliers = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await supplierService.list());
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.create(req.body as SupplierDto);
  logger.info('Supplier created', { supplierId: supplier.id, action: 'create_supplier' });
  ok(res, supplier, 201);
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.update(String(req.params['id']), req.body as SupplierDto);
  logger.info('Supplier updated', { supplierId: supplier.id, action: 'update_supplier' });
  ok(res, supplier);
});

export const setSupplierActive = asyncHandler(async (req: Request, res: Response) => {
  const isActive = Boolean((req.body as { isActive?: unknown }).isActive);
  const supplier = await supplierService.setActive(String(req.params['id']), isActive);
  logger.info('Supplier availability changed', { supplierId: supplier.id, isActive, action: 'toggle_supplier' });
  ok(res, supplier);
});

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  await supplierService.remove(String(req.params['id']));
  logger.info('Supplier deleted', { supplierId: String(req.params['id']), action: 'delete_supplier' });
  ok(res, null);
});

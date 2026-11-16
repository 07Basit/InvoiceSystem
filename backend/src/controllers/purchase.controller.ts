import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { purchaseService } from '../services/purchase.service';
import type { ListPurchasesQuery, PriceHistoryQuery, PriceOverviewQuery, PurchaseInvoiceDto, PurchaseReportQuery } from 'shared';

const ok = (res: Response, data: unknown, status = 200, meta: unknown = null) => res.status(status).json({ success: true, data, error: null, meta });

export const listPurchases = asyncHandler(async (req: Request, res: Response) => {
  const result = await purchaseService.list(req.query as unknown as ListPurchasesQuery);
  ok(res, result.data, 200, result.meta);
});

export const getPurchase = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await purchaseService.getById(String(req.params['id'])));
});

export const createPurchase = asyncHandler(async (req: Request, res: Response) => {
  const purchase = await purchaseService.create(req.body as PurchaseInvoiceDto);
  logger.info('Purchase invoice created', { purchaseId: purchase.id, supplierId: purchase.supplierId, action: 'create_purchase' });
  ok(res, purchase, 201);
});

export const updatePurchase = asyncHandler(async (req: Request, res: Response) => {
  const purchase = await purchaseService.update(String(req.params['id']), req.body as PurchaseInvoiceDto);
  logger.info('Purchase invoice updated', { purchaseId: purchase.id, action: 'update_purchase' });
  ok(res, purchase);
});

export const deletePurchase = asyncHandler(async (req: Request, res: Response) => {
  await purchaseService.remove(String(req.params['id']));
  logger.info('Purchase invoice deleted', { purchaseId: String(req.params['id']), action: 'delete_purchase' });
  ok(res, null);
});

/** Reads an uploaded Excel invoice and returns what was found, for the review screen. Nothing is saved. */
export const previewPurchaseImport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('Choose an Excel file to upload', 400, 'PURCHASE_NO_FILE');
  const body = req.body as { supplierId?: string; template?: string };
  let template: unknown;
  if (body.template) {
    try { template = JSON.parse(body.template); } catch { throw new AppError('The template is not valid', 400, 'PURCHASE_BAD_TEMPLATE'); }
  }
  // browsers send the name as latin1 bytes; read it back as UTF-8
  const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const parsed = await purchaseService.preview({ buffer: req.file.buffer, originalname }, { supplierId: body.supplierId || undefined, template });
  logger.info('Purchase invoice read', { fileName: originalname, lines: parsed.lines.length, duplicates: parsed.duplicates.length, action: 'preview_purchase' });
  ok(res, parsed);
});

export const purchaseReport = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await purchaseService.report(req.query as unknown as PurchaseReportQuery));
});

export const purchasePriceHistory = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await purchaseService.priceHistory(req.query as unknown as PriceHistoryQuery));
});

export const purchaseOverview = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await purchaseService.overview(req.query as unknown as PriceOverviewQuery));
});

export const purchaseProducts = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await purchaseService.productNames());
});

export const purchaseLastRates = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await purchaseService.lastRates());
});

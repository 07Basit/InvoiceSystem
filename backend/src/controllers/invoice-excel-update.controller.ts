import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { actorOf, events } from '../services/notification.events';
import { invoiceExcelUpdateService } from '../services/invoice-excel-update.service';
import type { ExcelUpdateApplyDto } from 'shared';

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data, error: null, meta: null });

export const previewExcelUpdate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('Choose the Excel file to upload', 400, 'EXCEL_NO_FILE');
  const id = String(req.params['id']);
  // browsers send the name as latin1 bytes; read it back as UTF-8
  const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const preview = await invoiceExcelUpdateService.preview(id, { buffer: req.file.buffer, originalname });
  logger.info('Invoice Excel read for an update', { invoiceId: id, added: preview.counts.added, removed: preview.counts.removed, changed: preview.counts.changed, action: 'preview_excel_update' });
  ok(res, preview);
});

export const applyExcelUpdate = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const record = await invoiceExcelUpdateService.apply(id, req.body as ExcelUpdateApplyDto);
  await events.invoiceUpdated(actorOf(req), id);
  logger.info('Invoice updated from Excel', { invoiceId: id, added: record.added, removed: record.removed, changed: record.changed, action: 'apply_excel_update' });
  ok(res, record, 201);
});

export const latestExcelUpdate = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await invoiceExcelUpdateService.latest(String(req.params['id'])));
});

export const undoExcelUpdate = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  await invoiceExcelUpdateService.undo(id);
  await events.invoiceUpdated(actorOf(req), id);
  logger.info('Invoice Excel update undone', { invoiceId: id, action: 'undo_excel_update' });
  ok(res, null);
});

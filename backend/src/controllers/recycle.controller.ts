import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { recycleService } from '../services/recycle.service';

const ALLOWED_TYPES = ['invoice', 'importer'] as const;
type RecordType = (typeof ALLOWED_TYPES)[number];

function validateType(type: string): RecordType {
  if (!ALLOWED_TYPES.includes(type as RecordType)) {
    const err = new Error('Invalid record type. Must be "invoice" or "importer".');
    (err as NodeJS.ErrnoException).code = 'INVALID_TYPE';
    throw Object.assign(err, { statusCode: 400 });
  }
  return type as RecordType;
}

export const listDeleted = asyncHandler(async (_req: Request, res: Response) => {
  const data = await recycleService.listDeleted();
  res.json({ success: true, data, error: null, meta: null });
});

export const restoreRecord = asyncHandler(async (req: Request, res: Response) => {
  const type = validateType(String(req.params['type']));
  const id = String(req.params['id']);
  const result = await recycleService.restore(type, id);
  logger.info('Record restored', { type, id, action: 'restore_record' });
  res.json({ success: true, data: result, error: null, meta: null });
});

export const permanentDeleteRecord = asyncHandler(async (req: Request, res: Response) => {
  const type = validateType(String(req.params['type']));
  const id = String(req.params['id']);
  await recycleService.permanentDelete(type, id);
  logger.info('Record permanently deleted', { type, id, action: 'permanent_delete' });
  res.json({ success: true, data: null, error: null, meta: null });
});

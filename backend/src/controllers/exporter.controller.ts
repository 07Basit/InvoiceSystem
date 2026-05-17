import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { exporterService } from '../services/exporter.service';
import type { UpsertExporterProfileDto } from 'shared';

export const getExporterProfile = asyncHandler(async (_req: Request, res: Response) => {
  const profile = await exporterService.getProfile();
  res.json({ success: true, data: profile, error: null, meta: null });
});

export const upsertExporterProfile = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as UpsertExporterProfileDto;
  const profile = await exporterService.upsertProfile(dto);
  logger.info('Exporter profile updated', { exporterId: profile.id, action: 'upsert_exporter_profile' });
  res.json({ success: true, data: profile, error: null, meta: null });
});

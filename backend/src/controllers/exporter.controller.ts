import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { exporterService } from '../services/exporter.service';
import type { ExporterProfileDto } from 'shared';

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, error: null, meta: null });

export const listExporterProfiles = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await exporterService.list());
});

export const createExporterProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await exporterService.create(req.body as ExporterProfileDto);
  logger.info('Exporter profile created', { exporterId: profile.id, action: 'create_exporter_profile' });
  ok(res, profile, 201);
});

export const updateExporterProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await exporterService.update(String(req.params.id), req.body as ExporterProfileDto);
  logger.info('Exporter profile updated', { exporterId: profile.id, action: 'update_exporter_profile' });
  ok(res, profile);
});

export const setDefaultExporterProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await exporterService.setDefault(String(req.params.id));
  logger.info('Default exporter profile changed', { exporterId: profile.id, action: 'default_exporter_profile' });
  ok(res, profile);
});

export const deleteExporterProfile = asyncHandler(async (req: Request, res: Response) => {
  await exporterService.remove(String(req.params.id));
  logger.info('Exporter profile deleted', { exporterId: String(req.params.id), action: 'delete_exporter_profile' });
  ok(res, null);
});

export const setExporterProfileActive = asyncHandler(async (req: Request, res: Response) => {
  const isActive = Boolean((req.body as { isActive?: unknown }).isActive);
  const profile = await exporterService.setActive(String(req.params.id), isActive);
  logger.info('Exporter profile availability changed', { exporterId: profile.id, isActive, action: 'toggle_exporter_profile' });
  ok(res, profile);
});

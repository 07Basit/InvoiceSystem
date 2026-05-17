import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { importerService } from '../services/importer.service';
import type { CreateImporterDto, ListImportersQuery, UpdateImporterDto } from 'shared';

export const listImporters = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListImportersQuery;
  const result = await importerService.list(query);
  res.json({ success: true, data: result.data, error: null, meta: result.meta });
});

export const getImporter = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const importer = await importerService.getById(id);
  logger.info('Importer fetched', { importerId: importer.id, action: 'get_importer' });
  res.json({ success: true, data: importer, error: null, meta: null });
});

export const createImporter = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as CreateImporterDto;
  const importer = await importerService.create(dto);
  logger.info('Importer created', { importerId: importer.id, action: 'create_importer' });
  res.status(201).json({ success: true, data: importer, error: null, meta: null });
});

export const updateImporter = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as UpdateImporterDto;
  const id = String(req.params['id']);
  const importer = await importerService.update(id, dto);
  logger.info('Importer updated', { importerId: importer.id, action: 'update_importer' });
  res.json({ success: true, data: importer, error: null, meta: null });
});

export const deleteImporter = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  await importerService.softDelete(id);
  logger.info('Importer deleted (soft)', { importerId: id, action: 'delete_importer' });
  res.json({ success: true, data: null, error: null, meta: null });
});

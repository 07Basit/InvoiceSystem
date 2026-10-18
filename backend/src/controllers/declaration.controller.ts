import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { declarationService } from '../services/declaration.service';
import type { DeclarationProfileDto } from 'shared';

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, error: null, meta: null });

export const listDeclarationProfiles = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await declarationService.list());
});

export const createDeclarationProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await declarationService.create(req.body as DeclarationProfileDto);
  logger.info('Declaration profile created', { declarationId: profile.id, action: 'create_declaration_profile' });
  ok(res, profile, 201);
});

export const updateDeclarationProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await declarationService.update(String(req.params.id), req.body as DeclarationProfileDto);
  logger.info('Declaration profile updated', { declarationId: profile.id, action: 'update_declaration_profile' });
  ok(res, profile);
});

export const setDefaultDeclarationProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await declarationService.setDefault(String(req.params.id));
  logger.info('Default declaration profile changed', { declarationId: profile.id, action: 'default_declaration_profile' });
  ok(res, profile);
});

export const deleteDeclarationProfile = asyncHandler(async (req: Request, res: Response) => {
  await declarationService.remove(String(req.params.id));
  logger.info('Declaration profile deleted', { declarationId: String(req.params.id), action: 'delete_declaration_profile' });
  ok(res, null);
});

export const setDeclarationProfileActive = asyncHandler(async (req: Request, res: Response) => {
  const isActive = Boolean((req.body as { isActive?: unknown }).isActive);
  const profile = await declarationService.setActive(String(req.params.id), isActive);
  logger.info('Declaration profile availability changed', { declarationId: profile.id, isActive, action: 'toggle_declaration_profile' });
  ok(res, profile);
});

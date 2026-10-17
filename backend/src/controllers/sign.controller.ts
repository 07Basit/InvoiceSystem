import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { signService } from '../services/sign.service';
import type { SignProfileDto } from 'shared';

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, error: null, meta: null });

export const listSignProfiles = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await signService.list());
});

export const createSignProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await signService.create(req.body as SignProfileDto);
  logger.info('Sign profile created', { signId: profile.id, action: 'create_sign_profile' });
  ok(res, profile, 201);
});

export const updateSignProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await signService.update(String(req.params.id), req.body as SignProfileDto);
  logger.info('Sign profile updated', { signId: profile.id, action: 'update_sign_profile' });
  ok(res, profile);
});

export const setDefaultSignProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await signService.setDefault(String(req.params.id));
  logger.info('Default seal & sign profile changed', { signId: profile.id, action: 'default_sign_profile' });
  ok(res, profile);
});

export const deleteSignProfile = asyncHandler(async (req: Request, res: Response) => {
  await signService.remove(String(req.params.id));
  logger.info('Sign profile deleted', { signId: String(req.params.id), action: 'delete_sign_profile' });
  ok(res, null);
});

export const setSignProfileActive = asyncHandler(async (req: Request, res: Response) => {
  const isActive = Boolean((req.body as { isActive?: unknown }).isActive);
  const profile = await signService.setActive(String(req.params.id), isActive);
  logger.info('Sign profile availability changed', { signId: profile.id, isActive, action: 'toggle_sign_profile' });
  ok(res, profile);
});

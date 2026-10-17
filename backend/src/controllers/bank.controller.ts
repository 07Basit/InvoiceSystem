import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { bankService } from '../services/bank.service';
import type { BankProfileDto } from 'shared';

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, error: null, meta: null });

export const listBankProfiles = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await bankService.list());
});

export const createBankProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await bankService.create(req.body as BankProfileDto);
  logger.info('Bank profile created', { bankId: profile.id, action: 'create_bank_profile' });
  ok(res, profile, 201);
});

export const updateBankProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await bankService.update(String(req.params.id), req.body as BankProfileDto);
  logger.info('Bank profile updated', { bankId: profile.id, action: 'update_bank_profile' });
  ok(res, profile);
});

export const setDefaultBankProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await bankService.setDefault(String(req.params.id));
  logger.info('Default bank profile changed', { bankId: profile.id, action: 'default_bank_profile' });
  ok(res, profile);
});

export const deleteBankProfile = asyncHandler(async (req: Request, res: Response) => {
  await bankService.remove(String(req.params.id));
  logger.info('Bank profile deleted', { bankId: String(req.params.id), action: 'delete_bank_profile' });
  ok(res, null);
});

export const setBankProfileActive = asyncHandler(async (req: Request, res: Response) => {
  const isActive = Boolean((req.body as { isActive?: unknown }).isActive);
  const profile = await bankService.setActive(String(req.params.id), isActive);
  logger.info('Bank profile availability changed', { bankId: profile.id, isActive, action: 'toggle_bank_profile' });
  ok(res, profile);
});

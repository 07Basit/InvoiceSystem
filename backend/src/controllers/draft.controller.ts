import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { draftService } from '../services/draft.service';
import type { CreateDraftDto, DraftKind, UpdateDraftDto } from 'shared';

const me = (req: Request) => req.auth!.user.id;
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data, error: null, meta: null });

export const listDrafts = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await draftService.list(me(req), req.query['kind'] as DraftKind));
});

export const createDraft = asyncHandler(async (req: Request, res: Response) => {
  const draft = await draftService.create(me(req), req.body as CreateDraftDto);
  logger.info('Draft saved', { draftId: draft.id, kind: draft.kind, action: 'create_draft' });
  ok(res, draft, 201);
});

export const updateDraft = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await draftService.update(me(req), String(req.params['id']), req.body as UpdateDraftDto));
});

export const deleteDraft = asyncHandler(async (req: Request, res: Response) => {
  await draftService.remove(me(req), String(req.params['id']));
  logger.info('Draft deleted', { draftId: String(req.params['id']), action: 'delete_draft' });
  ok(res, null);
});

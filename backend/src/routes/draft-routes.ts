import { Router } from 'express';
import { validate } from '../middleware/validate';
import { createDraftSchema, listDraftsQuerySchema, updateDraftSchema } from 'shared';
import { createDraft, deleteDraft, listDrafts, updateDraft } from '../controllers/draft.controller';

const router = Router();

router.get('/', validate(listDraftsQuerySchema, 'query'), listDrafts);
router.post('/', validate(createDraftSchema), createDraft);
router.put('/:id', validate(updateDraftSchema), updateDraft);
router.delete('/:id', deleteDraft);

export default router;

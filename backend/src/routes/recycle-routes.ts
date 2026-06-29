import { Router } from 'express';
import {
  listDeleted,
  restoreRecord,
  permanentDeleteRecord,
} from '../controllers/recycle.controller';

const router = Router();

// GET /api/v1/recycle  — list all soft-deleted invoices + importers
router.get('/', listDeleted);

// PATCH /api/v1/recycle/:type/:id/restore  — restore one record
router.patch('/:type/:id/restore', restoreRecord);

// DELETE /api/v1/recycle/:type/:id  — permanently delete one record
router.delete('/:type/:id', permanentDeleteRecord);

export default router;

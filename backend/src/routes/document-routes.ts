import { Router } from 'express';
import { validate } from '../middleware/validate';
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  exportDocument,
} from '../controllers/document.controller';
import { createDocumentSchema, updateDocumentSchema, listDocumentsQuerySchema } from 'shared';

const router = Router();

router.get('/', validate(listDocumentsQuerySchema, 'query'), listDocuments);
router.get('/:id', getDocument);
router.get('/:id/export', exportDocument);
router.post('/', validate(createDocumentSchema), createDocument);
router.put('/:id', validate(updateDocumentSchema), updateDocument);
router.delete('/:id', deleteDocument);

export default router;

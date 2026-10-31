import { Router } from 'express';
import multer from 'multer';
import { validate } from '../middleware/validate';
import {
  listDocuments,
  getDocument,
  createDocument,
  importDocument,
  updateDocument,
  uploadDocumentFile,
  deleteDocument,
  downloadDocument,
} from '../controllers/document.controller';
import { createDocumentSchema, updateDocumentSchema, listDocumentsQuerySchema, importDocumentBodySchema } from 'shared';

const router = Router();

// Files are kept in the database (the hosting has no permanent disk), so they are held in memory while they are checked and saved.
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

router.get('/', validate(listDocumentsQuerySchema, 'query'), listDocuments);
router.post('/', validate(createDocumentSchema), createDocument);
router.post('/import', upload.single('file'), validate(importDocumentBodySchema), importDocument);
router.get('/:id', getDocument);
router.get('/:id/file', downloadDocument);
router.get('/:id/export', downloadDocument);
router.put('/:id', validate(updateDocumentSchema), updateDocument);
router.put('/:id/file', upload.single('file'), uploadDocumentFile);
router.delete('/:id', deleteDocument);

export default router;

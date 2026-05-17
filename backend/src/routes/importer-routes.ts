import { Router } from 'express';
import { validate } from '../middleware/validate';
import {
  listImporters,
  getImporter,
  createImporter,
  updateImporter,
  deleteImporter,
} from '../controllers/importer.controller';
import { createImporterSchema, listImportersQuerySchema, updateImporterSchema } from 'shared';

const router = Router();

router.get('/', validate(listImportersQuerySchema, 'query'), listImporters);
router.get('/:id', getImporter);
router.post('/', validate(createImporterSchema), createImporter);
router.put('/:id', validate(updateImporterSchema), updateImporter);
router.delete('/:id', deleteImporter);

export default router;

import { Router } from 'express';
import { validate } from '../middleware/validate';
import {
  listImporters,
  getImporter,
  getImporterSummary,
  createImporter,
  updateImporter,
  deleteImporter,
} from '../controllers/importer.controller';
import { downloadStatementExcel, downloadStatementPdf, getStatement } from '../controllers/statement.controller';
import { createImporterSchema, listImportersQuerySchema, statementQuerySchema, updateImporterSchema } from 'shared';

const router = Router();

router.get('/', validate(listImportersQuerySchema, 'query'), listImporters);
router.get('/summary', getImporterSummary);
router.get('/:id/statement', validate(statementQuerySchema, 'query'), getStatement);
router.get('/:id/statement/pdf', validate(statementQuerySchema, 'query'), downloadStatementPdf);
router.get('/:id/statement/excel', validate(statementQuerySchema, 'query'), downloadStatementExcel);
router.get('/:id', getImporter);
router.post('/', validate(createImporterSchema), createImporter);
router.put('/:id', validate(updateImporterSchema), updateImporter);
router.delete('/:id', deleteImporter);

export default router;

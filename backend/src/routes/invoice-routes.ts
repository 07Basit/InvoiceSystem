import { Router } from 'express';
import { validate } from '../middleware/validate';
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  downloadInvoicePdf,
  downloadInvoiceExcel,
  importInvoices,
  exportInvoices,
} from '../controllers/invoice.controller';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  listInvoicesQuerySchema,
} from 'shared';

const router = Router();

router.get('/', validate(listInvoicesQuerySchema, 'query'), listInvoices);
router.get('/export', exportInvoices);
router.post('/import', importInvoices);
router.get('/:id', getInvoice);
router.get('/:id/download/pdf', downloadInvoicePdf);
router.get('/:id/download/excel', downloadInvoiceExcel);
router.post('/', validate(createInvoiceSchema), createInvoice);
router.put('/:id', validate(updateInvoiceSchema), updateInvoice);
router.delete('/:id', deleteInvoice);

export default router;

import { Router } from 'express';
import { validate } from '../middleware/validate';
import {
  listInvoices,
  getInvoice,
  getInvoiceSummary,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  setInvoiceManualRate,
  clearInvoiceManualRate,
  downloadInvoicePdf,
  downloadInvoiceExcel,
  importInvoices,
  exportInvoices,
  nativeShareStatus,
  shareInvoiceNative,
} from '../controllers/invoice.controller';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  listInvoicesQuerySchema,
  manualRateSchema,
  shareNativeSchema,
} from 'shared';

const router = Router();

router.get('/', validate(listInvoicesQuerySchema, 'query'), listInvoices);
router.get('/export', exportInvoices);
router.get('/summary', getInvoiceSummary);
router.get('/share/native', nativeShareStatus);
router.post('/import', importInvoices);
router.get('/:id', getInvoice);
router.get('/:id/download/pdf', downloadInvoicePdf);
router.get('/:id/download/excel', downloadInvoiceExcel);
router.post('/:id/share/native', validate(shareNativeSchema), shareInvoiceNative);
router.post('/', validate(createInvoiceSchema), createInvoice);
router.put('/:id', validate(updateInvoiceSchema), updateInvoice);
router.put('/:id/exchange-rate', validate(manualRateSchema), setInvoiceManualRate);
router.delete('/:id/exchange-rate', clearInvoiceManualRate);
router.delete('/:id', deleteInvoice);

export default router;

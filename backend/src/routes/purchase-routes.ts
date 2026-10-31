import { Router } from 'express';
import multer from 'multer';
import { validate } from '../middleware/validate';
import { listPurchasesQuerySchema, priceHistoryQuerySchema, priceOverviewQuerySchema, purchaseInvoiceSchema, purchaseReportQuerySchema } from 'shared';
import {
  createPurchase, deletePurchase, getPurchase, listPurchases, previewPurchaseImport, purchaseLastRates, purchasePriceHistory, purchaseProducts, purchaseReport, purchaseOverview, updatePurchase,
} from '../controllers/purchase.controller';

const router = Router();

// The Excel file is only read, never kept: it is held in memory while it is checked.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

router.get('/', validate(listPurchasesQuerySchema, 'query'), listPurchases);
router.post('/', validate(purchaseInvoiceSchema), createPurchase);
router.post('/import/preview', upload.single('file'), previewPurchaseImport);
router.get('/reports/summary', validate(purchaseReportQuerySchema, 'query'), purchaseReport);
router.get('/reports/overview', validate(priceOverviewQuerySchema, 'query'), purchaseOverview);
router.get('/reports/price-history', validate(priceHistoryQuerySchema, 'query'), purchasePriceHistory);
router.get('/reports/products', purchaseProducts);
router.get('/reports/last-rates', purchaseLastRates);
router.get('/:id', getPurchase);
router.put('/:id', validate(purchaseInvoiceSchema), updatePurchase);
router.delete('/:id', deletePurchase);

export default router;

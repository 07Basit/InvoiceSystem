import { Router } from 'express';
import { validate } from '../middleware/validate';
import { deletePayment, listPaymentMethods, updatePayment } from '../controllers/payment.controller';
import { paymentSchema } from 'shared';

const router = Router();

router.get('/methods', listPaymentMethods);
router.put('/:id', validate(paymentSchema), updatePayment);
router.delete('/:id', deletePayment);

export default router;

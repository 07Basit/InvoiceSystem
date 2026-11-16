import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { paymentService } from '../services/payment.service';
import type { PaymentDto } from 'shared';

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data, error: null, meta: null });

export const listInvoicePayments = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await paymentService.forInvoice(String(req.params['id'])));
});

export const listPaymentMethods = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await paymentService.methods());
});

export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.create(String(req.params['id']), req.body as PaymentDto);
  logger.info('Payment recorded', { invoiceId: result.invoiceId, action: 'create_payment' });
  ok(res, result, 201);
});

export const updatePayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.update(String(req.params['id']), req.body as PaymentDto);
  logger.info('Payment changed', { invoiceId: result.invoiceId, action: 'update_payment' });
  ok(res, result);
});

export const deletePayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.remove(String(req.params['id']));
  logger.info('Payment deleted', { invoiceId: result.invoiceId, action: 'delete_payment' });
  ok(res, result);
});

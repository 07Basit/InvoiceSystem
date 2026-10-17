import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { currencyService } from '../services/currency.service';
import { actorOf, events } from '../services/notification.events';
import type { UpdateCurrencySettingsDto } from 'shared';

export const getCurrencySettings = asyncHandler(async (_req: Request, res: Response) => {
  const data = await currencyService.getSettingsView();
  res.json({ success: true, data, error: null, meta: null });
});

export const updateCurrencySettings = asyncHandler(async (req: Request, res: Response) => {
  const before = await currencyService.getBaseCurrency();
  const data = await currencyService.update(req.body as UpdateCurrencySettingsDto);
  if (data.baseCurrency !== before) await events.baseCurrencyChanged(actorOf(req), data.baseCurrency);
  logger.info('Currency settings updated', { baseCurrency: data.baseCurrency, action: 'update_currency_settings' });
  res.json({ success: true, data, error: null, meta: null });
});

import { z } from 'zod';

export const currencySettingsSchema = z.object({
  baseCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code'),
});

export type UpdateCurrencySettingsDto = z.infer<typeof currencySettingsSchema>;

// Exchange rate typed in by the user for one invoice: units of the reporting currency per 1 unit of the invoice currency.
export const manualRateSchema = z.object({
  rate: z.coerce.number().positive('Rate must be greater than 0').max(1_000_000_000, 'Rate is too large'),
});

export type ManualRateDto = z.infer<typeof manualRateSchema>;

import { z } from 'zod';

/** A list of products for one importer in one currency, optionally narrowed to one landing location. */
export const productListSchema = z.object({
  importerId: z.string().min(1, 'Choose an importer'),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Choose a currency'),
  locationName: z.string().trim().min(1).max(200).optional(),
});

export type ProductListDto = z.infer<typeof productListSchema>;

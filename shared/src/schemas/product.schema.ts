import { z } from 'zod';

/** A blank box means "no usual value", so it is allowed to be missing but never zero or negative. */
const optionalPositive = (label: string) => z.number({ invalid_type_error: `${label} must be a number` }).positive(`${label} must be above 0`).optional();

/** Where a product applies: nothing = the general list; an importer, optionally narrowed to a currency and a landing location. */
export const productSchema = z
  .object({
    name: z.string().trim().min(1, 'Product name is required').max(200),
    importerId: z.string().min(1).optional(),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code').optional(),
    locationName: z.string().trim().min(1).max(200).optional(),
    nettWeightPerPackage: optionalPositive('Nett weight per package'),
    ratePerKg: optionalPositive('Rate per kg'),
    hsCode: z.string().trim().max(30).optional(),
  })
  .refine((p) => p.importerId || (!p.currency && !p.locationName), { message: 'Choose an importer first', path: ['importerId'] })
  .refine((p) => p.currency || !p.locationName, { message: 'Choose a currency first', path: ['currency'] });

export type ProductDto = z.infer<typeof productSchema>;

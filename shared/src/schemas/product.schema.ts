import { z } from 'zod';

/** A blank box means "no usual value", so it is allowed to be missing but never zero or negative. */
const optionalPositive = (label: string) => z.number({ invalid_type_error: `${label} must be a number` }).positive(`${label} must be above 0`).optional();

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  nettWeightPerPackage: optionalPositive('Nett weight per package'),
  ratePerKg: optionalPositive('Rate per kg'),
  hsCode: z.string().trim().max(30).optional(),
});

export type ProductDto = z.infer<typeof productSchema>;

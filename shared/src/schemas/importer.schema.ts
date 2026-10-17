import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema';

export const landingLocationSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(1, 'Landing location name is required').max(120),
  portOfDischarge: z.string().trim().min(1, 'Port of discharge is required').max(40),
  finalDestination: z.string().trim().min(1, 'Final destination is required').max(80),
  countryOfDestination: z.string().trim().min(1, 'Country of destination is required').max(120),
});

export const loadingLocationSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(1, 'Loading location name is required').max(120),
  portOfLoading: z.string().trim().min(1, 'Port of loading is required').max(40),
  countryOfOrigin: z.string().trim().min(1, 'Country of origin is required').max(120),
});

export const createImporterSchema = z.object({
  name: z.string().trim().min(1, 'Importer name is required').max(200),
  address: z.string().trim().min(1, 'Address is required').max(500),
  // Optional: an empty string means "not provided". When given, the phone number must look like one.
  contact: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9+()\-\s]{7,20}$/.test(v), 'Contact must be 7-20 characters: numbers, + ( ) - and spaces')
    .optional(),
  email: z.string().email('Enter a valid email address').toLowerCase().optional(),
  buyerName: z.string().trim().max(200).optional(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Currency is required')
    .regex(/^[A-Z]{3}$/, 'Select a valid 3-letter currency code'),
  isActive: z.boolean().optional(),
  landingLocations: z.array(landingLocationSchema).min(1, 'At least one landing location is required'),
  loadingLocations: z.array(loadingLocationSchema).min(1, 'At least one loading location is required'),
});

export type CreateImporterDto = z.infer<typeof createImporterSchema>;

export const updateImporterSchema = createImporterSchema.partial();
export type UpdateImporterDto = z.infer<typeof updateImporterSchema>;

export const listImportersQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(['name', 'buyerName', 'createdAt']).default('name'),
  // "not needed" importers are marked inactive; 'all' returns both
  status: z.enum(['all', 'active', 'inactive']).default('all'),
});

export type ListImportersQuery = z.infer<typeof listImportersQuerySchema>;

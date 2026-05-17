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
  contact: z.string().trim().min(1, 'Contact is required').max(120),
  email: z.string().email('Invalid email address').toLowerCase().optional(),
  buyerName: z.string().trim().min(1, 'Buyer name is required').max(200),
  currency: z.string().trim().toUpperCase().min(3, 'Currency is required').max(6),
  landingLocations: z.array(landingLocationSchema).min(1, 'At least one landing location is required'),
  loadingLocations: z.array(loadingLocationSchema).min(1, 'At least one loading location is required'),
});

export type CreateImporterDto = z.infer<typeof createImporterSchema>;

export const updateImporterSchema = createImporterSchema.partial();
export type UpdateImporterDto = z.infer<typeof updateImporterSchema>;

export const listImportersQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(['name', 'buyerName', 'createdAt']).default('name'),
});

export type ListImportersQuery = z.infer<typeof listImportersQuerySchema>;

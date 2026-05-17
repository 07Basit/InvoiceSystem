import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema';

// ---------------------------------------------------------------------------
// Create Client
// ---------------------------------------------------------------------------
export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address').toLowerCase(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(500).optional(),
  company: z.string().trim().max(200).optional(),
  taxId: z.string().trim().max(50).optional(),
});

export type CreateClientDto = z.infer<typeof createClientSchema>;

// ---------------------------------------------------------------------------
// Update Client
// ---------------------------------------------------------------------------
export const updateClientSchema = createClientSchema.partial();
export type UpdateClientDto = z.infer<typeof updateClientSchema>;

// ---------------------------------------------------------------------------
// List Query
// ---------------------------------------------------------------------------
export const listClientsQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(['name', 'email', 'createdAt']).default('name'),
});

export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;

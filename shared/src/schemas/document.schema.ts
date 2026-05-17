import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema';

// ---------------------------------------------------------------------------
// Document type
// ---------------------------------------------------------------------------
export const documentTypeSchema = z.enum(['WORD', 'PDF']);
export type DocumentType = z.infer<typeof documentTypeSchema>;

// ---------------------------------------------------------------------------
// Word Document
// ---------------------------------------------------------------------------
export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string().optional().default(''),
  type: documentTypeSchema.default('WORD'),
});

export type CreateDocumentDto = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = createDocumentSchema.partial();
export type UpdateDocumentDto = z.infer<typeof updateDocumentSchema>;

export const listDocumentsQuerySchema = paginationQuerySchema.extend({
  type: documentTypeSchema.optional(),
  sort: z.enum(['title', 'createdAt', 'updatedAt']).default('updatedAt'),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;

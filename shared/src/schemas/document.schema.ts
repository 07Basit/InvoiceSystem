import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema';

// ---------------------------------------------------------------------------
// Document type
// ---------------------------------------------------------------------------
export const documentTypeSchema = z.enum(['WORD', 'PDF', 'EXCEL']);
export type DocumentType = z.infer<typeof documentTypeSchema>;

// ---------------------------------------------------------------------------
// Create / update a document.
// content: Word = the text as HTML, Excel = the sheets as JSON, PDF = plain text the new PDF is made from.
// ---------------------------------------------------------------------------
export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string().max(8_000_000).optional().default(''),
  type: documentTypeSchema.default('WORD'),
  starred: z.boolean().optional(),
});

export type CreateDocumentDto = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = createDocumentSchema.partial();
export type UpdateDocumentDto = z.infer<typeof updateDocumentSchema>;

export const listDocumentsQuerySchema = paginationQuerySchema.extend({
  type: documentTypeSchema.optional(),
  /** only the starred documents */
  starred: z.enum(['true']).optional(),
  sort: z.enum(['title', 'createdAt', 'updatedAt']).default('updatedAt'),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;

/** Adding a file: the file name decides the type (.docx, .xlsx or .pdf); the title is optional. */
export const importDocumentBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});
export type ImportDocumentBody = z.infer<typeof importDocumentBodySchema>;

/** What a document type is saved as when it is downloaded. */
export const DOCUMENT_FILE: Record<DocumentType, { extension: string; mime: string }> = {
  WORD: { extension: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  EXCEL: { extension: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  PDF: { extension: 'pdf', mime: 'application/pdf' },
};

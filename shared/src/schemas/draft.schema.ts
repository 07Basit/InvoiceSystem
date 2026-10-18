import { z } from 'zod';

export const draftKindSchema = z.enum(['invoice', 'importer']);
export type DraftKind = z.infer<typeof draftKindSchema>;

/** A draft is a half-finished form, so its values are not checked against the full invoice or importer rules. */
const draftData = z.record(z.string(), z.unknown());

export const listDraftsQuerySchema = z.object({ kind: draftKindSchema });

export const createDraftSchema = z.object({
  kind: draftKindSchema,
  data: draftData,
  // lets drafts moved over from the browser keep the date they were first saved
  createdAt: z.string().datetime().optional(),
});
export type CreateDraftDto = z.infer<typeof createDraftSchema>;

export const updateDraftSchema = z.object({ data: draftData });
export type UpdateDraftDto = z.infer<typeof updateDraftSchema>;

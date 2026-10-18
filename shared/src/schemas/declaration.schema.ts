import { z } from 'zod';

/** The declaration printed on an invoice: at most 2000 characters, line breaks kept. */
export const DECLARATION_MAX_CHARS = 2000;

export const declarationProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  text: z.string().trim().min(1, 'Declaration text is required').max(DECLARATION_MAX_CHARS, `At most ${DECLARATION_MAX_CHARS} characters`),
});

export type DeclarationProfileDto = z.infer<typeof declarationProfileSchema>;

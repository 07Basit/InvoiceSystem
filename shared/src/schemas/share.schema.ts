import { z } from 'zod';

/** Open the invoice file in a desktop app on the computer running the server. */
export const shareNativeSchema = z.object({
  kind: z.enum(['pdf', 'excel']),
  // clipboard = copy the file itself, so it can be pasted into an email or chat
  target: z.enum(['mail', 'whatsapp', 'clipboard']),
  // for the clipboard: the message to put next to the file (apps that take text paste it; chats take the file)
  text: z.string().max(2000).optional(),
});

export type ShareNativeDto = z.infer<typeof shareNativeSchema>;

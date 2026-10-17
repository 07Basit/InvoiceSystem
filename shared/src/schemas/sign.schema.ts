import { z } from 'zod';

/** A PNG or JPEG data URL, at most ~700 KB of text (the browser resizes images well below this). */
export const SIGN_IMAGE_MAX_CHARS = 700_000;
const imageDataUrl = z
  .string()
  .max(SIGN_IMAGE_MAX_CHARS, 'Image is too large')
  .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, 'Use a PNG or JPEG image');

export const signProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  image: imageDataUrl,
});

export type SignProfileDto = z.infer<typeof signProfileSchema>;

export const invoiceSignImageSchema = imageDataUrl;

import { z } from 'zod';

export const exporterProfileSchema = z.object({
  name: z.string().trim().min(1, 'Exporter name is required').max(200),
  address: z.string().trim().min(1, 'Exporter address is required').max(500),
  contact: z.string().trim().min(1, 'Exporter contact is required').max(120),
  email: z.string().email('Invalid email address').toLowerCase().optional(),
});

export type ExporterProfileDto = z.infer<typeof exporterProfileSchema>;

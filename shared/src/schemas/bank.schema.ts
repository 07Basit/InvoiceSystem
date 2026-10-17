import { z } from 'zod';

export const bankProfileSchema = z.object({
  bankName: z.string().trim().min(1, 'Bank name is required').max(200),
  accountNumber: z.string().trim().min(1, 'Account number is required').max(60),
  ifscCode: z.string().trim().max(30).optional(),
  swiftCode: z.string().trim().max(30).optional(),
});

export type BankProfileDto = z.infer<typeof bankProfileSchema>;

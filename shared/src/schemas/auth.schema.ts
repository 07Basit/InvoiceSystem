import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(64),
  password: z.string().min(1, 'Password is required').max(200),
  rememberMe: z.boolean().default(false),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(80),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address').max(200)]).optional(),
});
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(200),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
}

/** What the API returns on login. The token itself travels only in an httpOnly cookie. */
export interface AuthSession {
  expiresAt: string;
  rememberMe: boolean;
  user: AuthUser;
}

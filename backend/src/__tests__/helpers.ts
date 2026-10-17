import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';

export const TEST_PASSWORD = 'Correct-horse-9';
// Low cost factor keeps tests fast; production uses 12.
export const TEST_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user_1',
    username: 'admin',
    passwordHash: TEST_HASH,
    displayName: 'Administrator',
    email: null,
    role: 'ADMIN',
    tokenVersion: 0,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export const CSRF = { 'X-Requested-With': 'InvoiceManager' } as const;

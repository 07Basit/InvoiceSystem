import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import type { AuthSession, AuthUser, ChangePasswordDto, LoginDto, UpdateProfileDto } from 'shared';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError } from '../utils/AppError';

const BCRYPT_ROUNDS = 12;
// Compared against when the username is unknown so response time doesn't reveal valid usernames.
const DUMMY_HASH = bcrypt.hashSync('invalid-password-placeholder', BCRYPT_ROUNDS);

export interface TokenClaims {
  sub: string;
  tv: number;
  rm: boolean;
  exp?: number;
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export interface IssuedSession {
  token: string;
  session: AuthSession;
}

function issueSession(user: User, rememberMe: boolean): IssuedSession {
  const expiresIn = rememberMe ? config.JWT_EXPIRES_IN : config.SESSION_JWT_EXPIRES_IN;
  const claims: TokenClaims = { sub: user.id, tv: user.tokenVersion, rm: rememberMe };
  const token = jwt.sign(claims, config.JWT_SECRET, { expiresIn: expiresIn as NonNullable<jwt.SignOptions['expiresIn']> });
  const { exp } = jwt.decode(token) as { exp: number };
  return { token, session: { expiresAt: new Date(exp * 1000).toISOString(), rememberMe, user: toAuthUser(user) } };
}

export const authService = {
  async login({ username, password, rememberMe }: LoginDto): Promise<IssuedSession> {
    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return issueSession(updated, rememberMe);
  },

  /** Verifies a session token and returns the user it belongs to, or throws 401. */
  async authenticate(token: string): Promise<{ user: User; claims: TokenClaims }> {
    let claims: TokenClaims;
    try {
      claims = jwt.verify(token, config.JWT_SECRET) as unknown as TokenClaims;
    } catch {
      throw new AppError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
    }
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || user.tokenVersion !== claims.tv) {
      throw new AppError('Your session is no longer valid. Please sign in again.', 401, 'UNAUTHORIZED');
    }
    return { user, claims };
  },

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthUser> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { displayName: dto.displayName, email: dto.email ? dto.email.toLowerCase() : null },
    });
    return toAuthUser(user);
  },

  async changePassword(user: User, rememberMe: boolean, dto: ChangePasswordDto): Promise<IssuedSession> {
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
    if (dto.currentPassword === dto.newPassword) {
      throw new AppError('New password must be different from the current password', 400, 'PASSWORD_UNCHANGED');
    }
    // Bumping tokenVersion signs out every other device; the caller gets a fresh token.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS), tokenVersion: { increment: 1 } },
    });
    return issueSession(updated, rememberMe);
  },

  async signOutEverywhere(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  },
};

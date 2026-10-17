import { Request, Response, NextFunction } from 'express';
import type { User } from '@prisma/client';
import { authService, type TokenClaims } from '../services/auth.service';
import { AppError } from '../utils/AppError';

export const SESSION_COOKIE = 'session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { user: User; claims: TokenClaims };
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (!token) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    req.auth = await authService.authenticate(token);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * CSRF defence in depth (on top of SameSite=Strict cookies): browsers can't add a custom header to a
 * cross-site form post or image request, so state-changing calls must carry one.
 */
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers['x-requested-with'] !== 'InvoiceManager') {
    return next(new AppError('Missing required request header', 403, 'CSRF_REJECTED'));
  }
  next();
}

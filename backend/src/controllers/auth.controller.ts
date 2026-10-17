import { Request, Response, CookieOptions } from 'express';
import type { ChangePasswordDto, LoginDto, UpdateProfileDto } from 'shared';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { config } from '../config';
import { SESSION_COOKIE } from '../middleware/auth';
import { authService, toAuthUser, type IssuedSession } from '../services/auth.service';

const ok = <T>(data: T) => ({ success: true, data, error: null, meta: null });

// The session token lives only in this cookie: JavaScript on the page can never read it (httpOnly),
// it is only sent over HTTPS in production (secure) and never on cross-site requests (strict).
const baseCookie: CookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api',
};

function setSessionCookie(res: Response, { token, session }: IssuedSession) {
  res.cookie(SESSION_COOKIE, token, {
    ...baseCookie,
    // "Keep me signed in" -> persistent cookie; otherwise a browser-session cookie (gone when the browser closes).
    ...(session.rememberMe ? { expires: new Date(session.expiresAt) } : {}),
  });
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const issued = await authService.login(req.body as LoginDto);
  setSessionCookie(res, issued);
  logger.info('User signed in', { userId: issued.session.user.id, rememberMe: issued.session.rememberMe, action: 'login' });
  res.json(ok(issued.session));
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE, baseCookie);
  res.json(ok(null));
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const { user, claims } = req.auth!;
  const expiresAt = claims.exp ? new Date(claims.exp * 1000).toISOString() : null;
  res.json(ok({ user: toAuthUser(user), rememberMe: claims.rm, expiresAt }));
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.updateProfile(req.auth!.user.id, req.body as UpdateProfileDto);
  res.json(ok(user));
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { user, claims } = req.auth!;
  const issued = await authService.changePassword(user, claims.rm, req.body as ChangePasswordDto);
  setSessionCookie(res, issued);
  logger.info('Password changed', { userId: user.id, action: 'change_password' });
  res.json(ok(issued.session));
});

export const signOutEverywhere = asyncHandler(async (req: Request, res: Response) => {
  await authService.signOutEverywhere(req.auth!.user.id);
  res.clearCookie(SESSION_COOKIE, baseCookie);
  logger.info('Signed out everywhere', { userId: req.auth!.user.id, action: 'sign_out_all' });
  res.json(ok(null));
});

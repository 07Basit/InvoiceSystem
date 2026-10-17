import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const WINDOW_MS = 15 * 60 * 1000;

/** Requests that should never use up a person's allowance. */
export function isExempt(req: Request): boolean {
  return (
    req.method === 'OPTIONS' ||
    req.path === '/health' ||
    // the bell's background check for new notifications: cheap and automatic, so it must not starve real actions
    req.originalUrl.split('?')[0] === '/api/v1/notifications/unread-count'
  );
}

/**
 * General limit for the whole API, per client address, per 15 minutes. A single-page app makes several
 * calls for every page it shows, so this has to be far above "one request per click".
 * (Sign-in attempts have their own, much stricter limiter in the auth routes.)
 */
export function createApiLimiter(max: number) {
  return rateLimit({
    windowMs: WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isExempt,
    message: {
      success: false,
      data: null,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' },
      meta: null,
    },
  });
}

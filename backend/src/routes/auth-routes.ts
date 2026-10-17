import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePasswordSchema, loginSchema, updateProfileSchema } from 'shared';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { changePassword, login, logout, me, signOutEverywhere, updateMe } from '../controllers/auth.controller';

const router = Router();

// Brute-force protection: only failed attempts count toward the limit.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: { code: 'RATE_LIMITED', message: 'Too many failed sign-in attempts. Try again in 15 minutes.' },
    meta: null,
  },
});

router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, validate(updateProfileSchema), updateMe);
router.post('/change-password', requireAuth, validate(changePasswordSchema), changePassword);
router.post('/sign-out-everywhere', requireAuth, signOutEverywhere);

export default router;

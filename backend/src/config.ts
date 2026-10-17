import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('dev_secret_change_in_production'),
  // Lifetime of a "keep me signed in" session; sessions without it use SESSION_JWT_EXPIRES_IN.
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_JWT_EXPIRES_IN: z.string().default('12h'),
  // ExchangeRate-API key: used for currencies the ECB doesn't cover, on recent invoices only. Optional.
  EXCHANGERATE_API_KEY: z.string().trim().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// In production the app refuses to start with the built-in dev secret or a short one,
// because anyone who knows the secret can forge a login token.
if (
  parsed.data.NODE_ENV === 'production' &&
  (parsed.data.JWT_SECRET === 'dev_secret_change_in_production' || parsed.data.JWT_SECRET.length < 32)
) {
  console.error('JWT_SECRET must be a random string of at least 32 characters in production (openssl rand -hex 32)');
  process.exit(1);
}

export const config = parsed.data;

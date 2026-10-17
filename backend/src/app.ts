import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

const app = express();

// Behind a reverse proxy (Netlify/hosting) the real scheme comes from X-Forwarded-*; needed for secure cookies.
if (config.NODE_ENV === 'production') app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Security Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, data: null, error: { code: 'RATE_LIMITED', message: 'Too many requests' }, meta: null },
  }),
);

// ---------------------------------------------------------------------------
// Body Parsing
// ---------------------------------------------------------------------------
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// Request Logging
// ---------------------------------------------------------------------------
app.use(requestLogger);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1', apiRouter);

// ---------------------------------------------------------------------------
// Error Handling (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

export default app;

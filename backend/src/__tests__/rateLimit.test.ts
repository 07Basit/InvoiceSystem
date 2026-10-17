import express from 'express';
import request from 'supertest';
import { createApiLimiter, isExempt } from '../middleware/rateLimit';
import { config } from '../config';

// loading express and supertest for the first time can be slow on a busy machine
jest.setTimeout(20_000);

const makeApp = (max: number) => {
  const app = express();
  app.use(createApiLimiter(max));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/v1/invoices', (_req, res) => res.json({ ok: true }));
  app.get('/api/v1/notifications/unread-count', (_req, res) => res.json({ ok: true }));
  return app;
};

describe('API rate limiter', () => {
  it('allows requests up to the limit and then answers 429 with the standard error body', async () => {
    const app = makeApp(5);
    for (let i = 0; i < 5; i++) await request(app).get('/api/v1/invoices').expect(200);
    const blocked = await request(app).get('/api/v1/invoices');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ success: false, error: { code: 'RATE_LIMITED' } });
    expect(blocked.body.error.message).toMatch(/wait/i);
  });

  it('never counts the health check or the notification poll, even long after the limit is hit', async () => {
    const app = makeApp(2);
    await request(app).get('/api/v1/invoices').expect(200);
    await request(app).get('/api/v1/invoices').expect(200);
    await request(app).get('/api/v1/invoices').expect(429);
    for (let i = 0; i < 20; i++) {
      await request(app).get('/api/v1/notifications/unread-count').expect(200);
      await request(app).get('/health').expect(200);
    }
  });

  it('exempts the poll with a query string and CORS preflights, but not other notification calls', () => {
    const req = (method: string, originalUrl: string, path = originalUrl.split('?')[0]!) => ({ method, originalUrl, path }) as never;
    expect(isExempt(req('GET', '/api/v1/notifications/unread-count?x=1'))).toBe(true);
    expect(isExempt(req('OPTIONS', '/api/v1/invoices'))).toBe(true);
    expect(isExempt(req('GET', '/api/v1/notifications'))).toBe(false);
    expect(isExempt(req('POST', '/api/v1/notifications/read-all'))).toBe(false);
  });

  it('has a limit that suits a single-page app, not 13 requests a minute', () => {
    // each page shows several calls; the old 200-per-15-minutes cap was hit within minutes of normal use
    expect(config.RATE_LIMIT_MAX).toBeGreaterThanOrEqual(1000);
  });
});

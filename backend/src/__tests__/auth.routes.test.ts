import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prismaMock } from './setup';
import { CSRF, makeUser, TEST_PASSWORD } from './helpers';
import app from '../app';
import { config } from '../config';

const API = '/api/v1';
const cookiesOf = (res: request.Response) => (res.headers['set-cookie'] ?? []) as unknown as string[];
const sessionCookie = (res: request.Response) => cookiesOf(res).find((c) => c.startsWith('session=')) ?? '';

async function loginAs(rememberMe = false) {
  const user = makeUser();
  prismaMock.user.findUnique.mockResolvedValue(user);
  prismaMock.user.update.mockResolvedValue(user);
  const res = await request(app).post(`${API}/auth/login`).set(CSRF).send({ username: 'admin', password: TEST_PASSWORD, rememberMe });
  return { res, cookie: sessionCookie(res).split(';')[0]!, user };
}

describe('POST /auth/login', () => {
  it('sets an httpOnly, SameSite=Strict session cookie and keeps the token out of the body', async () => {
    const { res } = await loginAs(false);
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('admin');
    expect(JSON.stringify(res.body)).not.toMatch(/token|passwordHash/i);

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api/);
  });

  it('is a browser-session cookie when "keep me signed in" is off', async () => {
    const { res } = await loginAs(false);
    expect(sessionCookie(res)).not.toMatch(/Expires=|Max-Age=/i);
  });

  it('is a persistent ~7 day cookie when "keep me signed in" is on', async () => {
    const { res } = await loginAs(true);
    const expires = /Expires=([^;]+)/i.exec(sessionCookie(res))?.[1];
    expect(expires).toBeDefined();
    const days = (new Date(expires!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7.01);
  });

  it('returns 401 and no cookie for bad credentials', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    const res = await request(app).post(`${API}/auth/login`).set(CSRF).send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(sessionCookie(res)).toBe('');
  });

  it('returns 400 with field errors when the body is invalid', async () => {
    const res = await request(app).post(`${API}/auth/login`).set(CSRF).send({ username: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('username');
    expect(res.body.error.details).toHaveProperty('password');
  });

  it('rejects state-changing requests that lack the CSRF header', async () => {
    const res = await request(app).post(`${API}/auth/login`).send({ username: 'admin', password: TEST_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_REJECTED');
  });
});

describe('protected API', () => {
  it('returns 401 for every resource without a session', async () => {
    for (const path of ['/invoices', '/importers', '/documents', '/dashboard/overview', '/recycle', '/exporter-profile', '/auth/me']) {
      const res = await request(app).get(`${API}${path}`);
      expect(res.status).toBe(401);
    }
  });

  it('keeps /health public', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
  });

  it('ignores a bearer token — only the cookie authenticates', async () => {
    const user = makeUser();
    prismaMock.user.findUnique.mockResolvedValue(user);
    const token = jwt.sign({ sub: user.id, tv: 0, rm: false }, config.JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app).get(`${API}/auth/me`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('lets an authenticated request through', async () => {
    const { cookie } = await loginAs();
    prismaMock.$transaction.mockResolvedValue([[], 0] as never);
    const res = await request(app).get(`${API}/invoices`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('rejects a tampered cookie', async () => {
    const { cookie } = await loginAs();
    const res = await request(app).get(`${API}/auth/me`).set('Cookie', `${cookie}x`);
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me, PATCH /auth/me, logout', () => {
  it('returns the signed-in user and session info', async () => {
    const { cookie } = await loginAs(true);
    const res = await request(app).get(`${API}/auth/me`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('admin');
    expect(res.body.data.rememberMe).toBe(true);
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('validates profile updates', async () => {
    const { cookie } = await loginAs();
    const bad = await request(app).patch(`${API}/auth/me`).set(CSRF).set('Cookie', cookie).send({ displayName: '', email: 'not-an-email' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details).toHaveProperty('displayName');
    expect(bad.body.error.details).toHaveProperty('email');

    prismaMock.user.update.mockResolvedValue(makeUser({ displayName: 'Basit' }));
    const good = await request(app).patch(`${API}/auth/me`).set(CSRF).set('Cookie', cookie).send({ displayName: 'Basit', email: '' });
    expect(good.status).toBe(200);
    expect(good.body.data.displayName).toBe('Basit');
  });

  it('logout clears the cookie', async () => {
    const { cookie } = await loginAs();
    const res = await request(app).post(`${API}/auth/logout`).set(CSRF).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toMatch(/session=;/);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('POST /auth/change-password', () => {
  it('enforces password strength rules', async () => {
    const { cookie } = await loginAs();
    for (const newPassword of ['short1', 'onlyletterslong', '1234567890']) {
      const res = await request(app).post(`${API}/auth/change-password`).set(CSRF).set('Cookie', cookie)
        .send({ currentPassword: TEST_PASSWORD, newPassword });
      expect(res.status).toBe(400);
      expect(res.body.error.details).toHaveProperty('newPassword');
    }
  });

  it('rejects a wrong current password', async () => {
    const { cookie } = await loginAs();
    const res = await request(app).post(`${API}/auth/change-password`).set(CSRF).set('Cookie', cookie)
      .send({ currentPassword: 'wrong-password1', newPassword: 'Another-pass-22' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it('changes the password and re-issues the cookie so this session stays signed in', async () => {
    const { cookie } = await loginAs();
    prismaMock.user.update.mockResolvedValue(makeUser({ tokenVersion: 1 }));
    const res = await request(app).post(`${API}/auth/change-password`).set(CSRF).set('Cookie', cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'Another-pass-22' });
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toMatch(/^session=ey/);
    expect(sessionCookie(res).split(';')[0]).not.toBe(cookie);
  });
});

describe('POST /auth/sign-out-everywhere', () => {
  it('bumps the token version and clears the cookie', async () => {
    const { cookie } = await loginAs();
    const res = await request(app).post(`${API}/auth/sign-out-everywhere`).set(CSRF).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenLastCalledWith({ where: { id: 'user_1' }, data: { tokenVersion: { increment: 1 } } });
    expect(sessionCookie(res)).toMatch(/session=;/);
  });
});

// Keep last: this deliberately trips the failed-login rate limiter for the (shared) test IP.
describe('login rate limiting', () => {
  it('blocks further attempts after repeated failures', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    let blocked: request.Response | undefined;
    for (let i = 0; i < 15 && !blocked; i++) {
      const res = await request(app).post(`${API}/auth/login`).set(CSRF).send({ username: 'admin', password: 'wrong' });
      if (res.status === 429) blocked = res;
    }
    expect(blocked).toBeDefined();
    expect(blocked!.body.error.code).toBe('RATE_LIMITED');
  });
});

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prismaMock } from './setup';
import { makeUser, TEST_PASSWORD } from './helpers';
import { authService } from '../services/auth.service';
import { AppError } from '../utils/AppError';
import { config } from '../config';

const DAY = 24 * 60 * 60 * 1000;
const claimsOf = (token: string) => jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;

describe('authService.login', () => {
  it('signs in with valid credentials and records the login time', async () => {
    const user = makeUser();
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.user.update.mockResolvedValue({ ...user, lastLoginAt: new Date() });

    const { token, session } = await authService.login({ username: 'admin', password: TEST_PASSWORD, rememberMe: false });

    expect(session.user.username).toBe('admin');
    expect(session.user).not.toHaveProperty('passwordHash');
    expect(session).not.toHaveProperty('token'); // the token must never be part of the JSON body
    expect(claimsOf(token).sub).toBe('user_1');
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_1' }, data: { lastLoginAt: expect.any(Date) } }),
    );
  });

  it('looks usernames up case-insensitively', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    prismaMock.user.update.mockResolvedValue(makeUser());
    await authService.login({ username: 'ADMIN', password: TEST_PASSWORD, rememberMe: false });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { username: 'admin' } });
  });

  it('rejects a wrong password with a generic 401', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    await expect(authService.login({ username: 'admin', password: 'nope', rememberMe: false })).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password',
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('gives an unknown username the same error as a wrong password (no user enumeration)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const compare = jest.spyOn(bcrypt, 'compare');
    await expect(authService.login({ username: 'ghost', password: 'whatever', rememberMe: false })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid username or password',
    });
    expect(compare).toHaveBeenCalled(); // still does the expensive hash comparison
    compare.mockRestore();
  });

  it('keeps the session for 7 days when "keep me signed in" is on', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    prismaMock.user.update.mockResolvedValue(makeUser());
    const { token, session } = await authService.login({ username: 'admin', password: TEST_PASSWORD, rememberMe: true });
    const days = (new Date(session.expiresAt).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
    expect(claimsOf(token).rm).toBe(true);
  });

  it('uses a short session (12h) when "keep me signed in" is off', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    prismaMock.user.update.mockResolvedValue(makeUser());
    const { session } = await authService.login({ username: 'admin', password: TEST_PASSWORD, rememberMe: false });
    const hours = (new Date(session.expiresAt).getTime() - Date.now()) / (DAY / 24);
    expect(hours).toBeGreaterThan(11.9);
    expect(hours).toBeLessThanOrEqual(12);
  });
});

describe('authService.authenticate', () => {
  const tokenFor = (user = makeUser(), secret = config.JWT_SECRET, expiresIn: number | string = '1h') =>
    jwt.sign({ sub: user.id, tv: user.tokenVersion, rm: false }, secret, { expiresIn: expiresIn as never });

  it('accepts a valid token', async () => {
    const user = makeUser();
    prismaMock.user.findUnique.mockResolvedValue(user);
    const result = await authService.authenticate(tokenFor(user));
    expect(result.user.id).toBe('user_1');
  });

  it('rejects garbage, a wrongly-signed token and an expired token', async () => {
    await expect(authService.authenticate('not-a-jwt')).rejects.toBeInstanceOf(AppError);
    await expect(authService.authenticate(tokenFor(makeUser(), 'some-other-secret-some-other-secret'))).rejects.toMatchObject({ statusCode: 401 });
    await expect(authService.authenticate(tokenFor(makeUser(), config.JWT_SECRET, -10))).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a token for a user that no longer exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(authService.authenticate(tokenFor())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a token after sign-out-everywhere / password change (tokenVersion bumped)', async () => {
    const oldToken = tokenFor(makeUser({ tokenVersion: 0 }));
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ tokenVersion: 1 }));
    await expect(authService.authenticate(oldToken)).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('rejects a token signed with the "none" algorithm', async () => {
    const forged = jwt.sign({ sub: 'user_1', tv: 0, rm: false }, '', { algorithm: 'none' });
    await expect(authService.authenticate(forged)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('authService.changePassword', () => {
  it('rejects an incorrect current password', async () => {
    await expect(
      authService.changePassword(makeUser(), false, { currentPassword: 'wrong', newPassword: 'Brand-new-pass1' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CURRENT_PASSWORD' });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects reusing the same password', async () => {
    await expect(
      authService.changePassword(makeUser(), false, { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD }),
    ).rejects.toMatchObject({ code: 'PASSWORD_UNCHANGED' });
  });

  it('stores a new hash, bumps tokenVersion and returns a fresh session that keeps the remember setting', async () => {
    const user = makeUser();
    prismaMock.user.update.mockImplementation((async (args: { data: { passwordHash: string } }) =>
      makeUser({ passwordHash: args.data.passwordHash, tokenVersion: 1 })) as never);

    const { token, session } = await authService.changePassword(user, true, {
      currentPassword: TEST_PASSWORD,
      newPassword: 'Brand-new-pass1',
    });

    const data = prismaMock.user.update.mock.calls[0]![0].data as { passwordHash: string; tokenVersion: { increment: number } };
    expect(data.tokenVersion).toEqual({ increment: 1 });
    expect(data.passwordHash).not.toBe('Brand-new-pass1');
    expect(await bcrypt.compare('Brand-new-pass1', data.passwordHash)).toBe(true);
    expect(claimsOf(token).tv).toBe(1);
    expect(session.rememberMe).toBe(true);
  });
});

describe('authService.signOutEverywhere / updateProfile', () => {
  it('invalidates all tokens by bumping tokenVersion', async () => {
    await authService.signOutEverywhere('user_1');
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'user_1' }, data: { tokenVersion: { increment: 1 } } });
  });

  it('lowercases the email and clears it when empty', async () => {
    prismaMock.user.update.mockResolvedValue(makeUser());
    await authService.updateProfile('user_1', { displayName: 'Basit', email: 'Basit@Example.COM' });
    expect(prismaMock.user.update).toHaveBeenLastCalledWith({ where: { id: 'user_1' }, data: { displayName: 'Basit', email: 'basit@example.com' } });
    await authService.updateProfile('user_1', { displayName: 'Basit', email: '' });
    expect(prismaMock.user.update).toHaveBeenLastCalledWith({ where: { id: 'user_1' }, data: { displayName: 'Basit', email: null } });
  });
});

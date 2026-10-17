import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import { apiClient, ApiClientError } from '../api';
import { onUnauthorized } from '@/lib/authEvents';

const original = apiClient.defaults.adapter;
const unauthorized = vi.fn();

function respondWith(status: number, body: unknown = {}) {
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const response = { data: body, status, statusText: String(status), headers: {}, config } as AxiosResponse;
    if (status >= 400) throw new AxiosError('failed', String(status), config, null, response);
    return response;
  };
  apiClient.defaults.adapter = adapter;
}

beforeEach(() => {
  unauthorized.mockReset();
  onUnauthorized(unauthorized);
});
afterEach(() => {
  apiClient.defaults.adapter = original as AxiosAdapter;
});

describe('apiClient', () => {
  it('sends cookies and the CSRF header on every request', async () => {
    let seen: InternalAxiosRequestConfig | undefined;
    apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      seen = config;
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    }) as AxiosAdapter;
    await apiClient.get('/invoices');
    expect(seen?.withCredentials).toBe(true);
    expect(seen?.headers.get('X-Requested-With')).toBe('InvoiceManager');
    expect(seen?.headers.has('Authorization')).toBe(false); // no token handling in JS
  });

  it('treats a 401 from a normal endpoint as an expired session', async () => {
    respondWith(401, { error: { code: 'UNAUTHORIZED', message: 'Your session has expired. Please sign in again.' } });
    await expect(apiClient.get('/invoices')).rejects.toBeInstanceOf(ApiClientError);
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  it.each(['/auth/login', '/auth/me'])('does not trigger a sign-out for a 401 from %s', async (url) => {
    respondWith(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
    await expect(apiClient.request({ url, method: url.endsWith('login') ? 'post' : 'get' })).rejects.toMatchObject({
      message: 'Invalid username or password',
      status: 401,
    });
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('does not sign out on other errors', async () => {
    respondWith(500, { error: { code: 'INTERNAL', message: 'Boom' } });
    await expect(apiClient.get('/invoices')).rejects.toMatchObject({ status: 500, code: 'INTERNAL', message: 'Boom' });
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('exposes validation details from the API', async () => {
    respondWith(400, { error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: { email: ['Enter a valid email address'] } } });
    await expect(apiClient.patch('/auth/me', {})).rejects.toMatchObject({ details: { email: ['Enter a valid email address'] } });
  });
});

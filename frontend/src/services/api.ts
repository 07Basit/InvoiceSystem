import axios from 'axios';
import { notifyUnauthorized } from '@/lib/authEvents';
import { queryClient } from '@/lib/queryClient';

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
const BASE_URL = viteEnv?.['VITE_API_BASE_URL'] ?? '/api/v1';

interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: Record<string, string[]>;
}

export class ApiClientError extends Error {
  code: string | undefined;
  details: Record<string, string[]> | undefined;
  status: number | undefined;

  constructor(message: string, options?: { code?: string; details?: Record<string, string[]>; status?: number }) {
    super(message);
    this.name = 'ApiClientError';
    this.code = options?.code;
    this.details = options?.details;
    this.status = options?.status;
  }
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'InvoiceManager' },
  // The session lives in an httpOnly cookie that the browser attaches to API calls.
  withCredentials: true,
  timeout: 30_000,
});

// Response interceptor — unwrap data or throw ApiError
apiClient.interceptors.response.use(
  (response) => {
    // Anything that changes data (create/edit/delete) may have produced a notification on the server, so the
    // bell's unread count and lists are refreshed right away instead of waiting for the next poll.
    const method = String(response.config.method ?? 'get').toLowerCase();
    // (notification calls refresh their own queries, so they are skipped here to avoid doing it twice)
    if (method !== 'get' && !/\/(auth|notifications)(\/|$)/.test(String(response.config.url ?? ''))) {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
    return response;
  },
  (error) => {
    const apiError = error.response?.data?.error as ApiErrorPayload | undefined;
    const message =
      apiError?.message ??
      error.message ??
      'An unexpected error occurred';

    const status = error.response?.status;
    // An expired/revoked session anywhere in the app sends the user back to the login page.
    // (Login itself returns 401 for bad credentials, which the form handles.)
    if (status === 401 && !/\/auth\/(login|me)/.test(String(error.config?.url ?? ''))) {
      notifyUnauthorized();
    }
    const options = {
      ...(apiError?.code ? { code: apiError.code } : {}),
      ...(apiError?.details ? { details: apiError.details } : {}),
      ...(typeof status === 'number' ? { status } : {}),
    };

    return Promise.reject(new ApiClientError(message, options));
  },
);

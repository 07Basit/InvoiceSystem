import axios from 'axios';

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
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Response interceptor — unwrap data or throw ApiError
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = error.response?.data?.error as ApiErrorPayload | undefined;
    const message =
      apiError?.message ??
      error.message ??
      'An unexpected error occurred';

    const status = error.response?.status;
    const options = {
      ...(apiError?.code ? { code: apiError.code } : {}),
      ...(apiError?.details ? { details: apiError.details } : {}),
      ...(typeof status === 'number' ? { status } : {}),
    };

    return Promise.reject(new ApiClientError(message, options));
  },
);

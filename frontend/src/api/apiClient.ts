import { logger } from '../utils/logger';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;

let resolvedBaseUrl: string;
if (!rawBaseUrl) {
  resolvedBaseUrl = 'http://localhost:3001';
  logger.warn('VITE_API_BASE_URL is not set; falling back to http://localhost:3001');
} else {
  resolvedBaseUrl = rawBaseUrl;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${resolvedBaseUrl}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  baseUrl: resolvedBaseUrl,

  get<T>(path: string, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: 'GET' });
  },

  post<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: 'POST', body: JSON.stringify(body) });
  },

  patch<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: 'PATCH', body: JSON.stringify(body) });
  },

  put<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: 'PUT', body: JSON.stringify(body) });
  },

  delete<T>(path: string, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: 'DELETE' });
  },

  async deleteEmpty(path: string, init?: RequestInit): Promise<void> {
    const url = `${resolvedBaseUrl}${path}`;
    const response = await fetch(url, {
      ...init,
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  },
};

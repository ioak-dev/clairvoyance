import { env } from './env';

export interface RequestOptions extends RequestInit {
  preferRepresentation?: boolean;
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (env.postgrestJwt && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${env.postgrestJwt}`);
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.preferRepresentation) {
    headers.set('Prefer', 'return=representation');
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const http = {
  get: <T>(url: string) => request<T>(url, { method: 'GET' }),
  post: <T>(url: string, body: unknown, options: RequestOptions = {}) =>
    request<T>(url, { ...options, method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown, options: RequestOptions = {}) =>
    request<T>(url, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(url: string, options: RequestOptions = {}) =>
    request<T>(url, { ...options, method: 'DELETE' }),
};

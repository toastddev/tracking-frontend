import { auth } from './auth';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  // If BASE is empty we get an absolute URL with the dashboard origin —
  // strip back to a relative path so the dev proxy and prod sub-paths work.
  return BASE ? url.toString() : url.pathname + url.search;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = auth.getToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (res.status === 401) {
    auth.clear();
    throw new ApiError(401, 'unauthorized', 'unauthorized');
  }

  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('application/json') ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const code = (data && typeof data === 'object' && 'error' in data) ? String((data as { error: unknown }).error) : 'request_failed';
    throw new ApiError(res.status, code, code);
  }

  return data as T;
}

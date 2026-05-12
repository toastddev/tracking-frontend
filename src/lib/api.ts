import { auth } from './auth';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code?: string;
  // Original JSON body of the failing response, when the server returned
  // structured details (e.g. a 409 carrying `active_run_id`). Always check
  // `instanceof ApiError` before accessing.
  body?: unknown;
  constructor(status: number, message: string, code?: string, body?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
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

// Authed download for binary / CSV endpoints. Returns the response so the
// caller can read the blob + headers (e.g. Content-Disposition, X-Row-Count).
// Same auth + 401 handling as `api`, but doesn't try to JSON-parse the body.
export async function apiDownload(
  path: string,
  opts: RequestOptions = {},
): Promise<Response> {
  const token = auth.getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    signal: opts.signal,
  });

  if (res.status === 401) {
    auth.clear();
    throw new ApiError(401, 'unauthorized', 'unauthorized');
  }
  if (!res.ok) {
    // Try to surface a JSON error body if the server sent one.
    const ct = res.headers.get('content-type') ?? '';
    const data = ct.includes('application/json') ? await res.json().catch(() => null) : null;
    const code = data && typeof data === 'object' && 'error' in data
      ? String((data as { error: unknown }).error)
      : 'request_failed';
    throw new ApiError(res.status, code, code, data);
  }
  return res;
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
    throw new ApiError(res.status, code, code, data);
  }

  return data as T;
}

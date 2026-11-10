const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors: { field?: string; message: string }[] | null = null) { super(message); }
}
export interface Meta { page: number; limit: number; total: number }
export interface ApiResult<T> { data: T; meta: Meta | null; message: string }

// The access token lives in memory only (never localStorage). The refresh token is an httpOnly cookie.
let accessToken: string | null = null;
let supplierId: string | null = null;
let onSessionLost: () => void = () => {};
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const setSupplierScope = (id: string | null) => { supplierId = id; };
export const setSessionLostHandler = (fn: () => void) => { onSessionLost = fn; };

const cookie = (name: string) => document.cookie.split('; ').find((c) => c.startsWith(name + '='))?.split('=')[1] ?? '';

let refreshing: Promise<boolean> | null = null;
export function refreshSession(): Promise<{ accessToken: string; user: any } | null> {
  if (!cookie('csrf_token')) return Promise.resolve(null); // no session cookies at all: nothing to refresh
  return fetch(BASE + '/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': decodeURIComponent(cookie('csrf_token')) } })
    .then(async (r) => { if (!r.ok) return null; const j = await r.json(); accessToken = j.data.accessToken; return j.data as { accessToken: string; user: any }; })
    .catch(() => null);
}
const refreshOnce = () => (refreshing ??= refreshSession().then((r) => !!r).finally(() => { refreshing = null; }));

interface Opts { method?: string; query?: Record<string, unknown>; body?: unknown; form?: FormData; signal?: AbortSignal; raw?: boolean }
function url(path: string, query?: Record<string, unknown>) {
  const u = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  return u.pathname + u.search;
}
async function send(path: string, o: Opts): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (supplierId) headers['X-Supplier-Id'] = supplierId;
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(url(path, o.query), { method: o.method ?? 'GET', credentials: 'include', headers, signal: o.signal, body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined) });
}

export async function api<T = any>(path: string, o: Opts = {}): Promise<ApiResult<T>> {
  let res = await send(path, o);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshOnce()) res = await send(path, o); else { onSessionLost(); throw new ApiError(401, 'Your session has expired'); }
  }
  if (o.raw) { if (!res.ok) throw new ApiError(res.status, 'Download failed'); return { data: (await res.blob()) as unknown as T, meta: null, message: '' }; }
  let j: any = null;
  try { j = await res.json(); } catch { /* not json */ }
  if (!res.ok || !j?.success) throw new ApiError(res.status, j?.message ?? `Request failed (${res.status})`, Array.isArray(j?.errors) ? j.errors : null);
  return { data: j.data as T, meta: j.meta, message: j.message };
}

export async function download(path: string, query: Record<string, unknown>, filename: string) {
  const { data } = await api<Blob>(path, { query, raw: true });
  const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

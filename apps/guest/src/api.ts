// Tiny client for the public guest API. The guest token lives in sessionStorage only: closing the tab signs the guest out.
const BASE = `${import.meta.env.BASE_URL.replace(/\/guest\/$/, '')}/api/v1/guest`.replace(/^\/\//, '/');
const KEY = 'guest.token';
export const getToken = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t: string | null) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* storage blocked: stay signed in for this page load only */ } };

export class ApiError extends Error { constructor(m: string, public status: number) { super(m); } }
let onExpired: () => void = () => {};
export const setOnExpired = (f: () => void) => { onExpired = f; };

export async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let r: Response;
  try {
    r = await fetch(BASE + path, { method: init.method ?? 'GET', headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: init.body ? JSON.stringify(init.body) : undefined });
  } catch { throw new ApiError('No connection. Please check your internet and try again.', 0); }
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401 && token) { setToken(null); onExpired(); }
    throw new ApiError(j?.message || 'Something went wrong. Please try again.', r.status);
  }
  return j.data as T;
}

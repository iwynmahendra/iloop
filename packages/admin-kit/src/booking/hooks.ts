import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

/** GET helper. The supplier scope is part of the key so the operator's switcher refetches everything. */
export function useGet<T = any>(path: string | null, query?: Record<string, unknown>, opts: { refetchInterval?: number; enabled?: boolean } = {}) {
  const { scopeSupplier } = useAuth();
  return useQuery({ queryKey: ['bk', path, query, scopeSupplier], queryFn: async () => (await api<T>(path!, { query })).data, enabled: !!path && opts.enabled !== false, refetchInterval: opts.refetchInterval });
}
/** GET returning {data, meta} (paginated lists). */
export function useList<T = any>(path: string, query?: Record<string, unknown>) {
  const { scopeSupplier } = useAuth();
  return useQuery({ queryKey: ['bk', path, query, scopeSupplier, 'list'], queryFn: () => api<T[]>(path, { query }), placeholderData: (p) => p });
}
export const errText = (e: unknown) => (e instanceof ApiError ? (e.errors?.length ? `${e.message}: ${e.errors.map((x) => `${x.field ? x.field + ' ' : ''}${x.message}`).join('; ')}` : e.message) : e instanceof Error ? e.message : 'Something went wrong');

/** Mutation that toasts the result and refreshes every booking query. */
export function useAct<V = void, R = any>(fn: (v: V) => Promise<R>, ok?: string, onDone?: (r: R) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => { if (ok) toast.success(ok); qc.invalidateQueries({ queryKey: ['bk'] }); onDone?.(r); },
    onError: (e) => { toast.error(errText(e)); },
  });
}
export const post = (path: string, body?: unknown) => api(path, { method: 'POST', body: body ?? {} });
export const patch = (path: string, body: unknown) => api(path, { method: 'PATCH', body });

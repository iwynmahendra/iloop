import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, refreshSession, setAccessToken, setSessionLostHandler, setSupplierScope } from './api';

export type Role = 'SUPER_ADMIN' | 'SUPPLIER_ADMIN' | 'SUPPLIER_STAFF';
export interface User { id: string; email: string; name: string; role: Role; supplierId: string | null; supplier: { id: string; code: string; name: string } | null; mustChangePassword: boolean }
interface Ctx {
  user: User | null; loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
  /** SUPER_ADMIN supplier switcher. null = all suppliers. */
  scopeSupplier: string | null; setScopeSupplier: (id: string | null) => void;
  can: { write: boolean; remove: boolean; manageUsers: boolean; manageSuppliers: boolean; audit: boolean };
}
const AuthCtx = createContext<Ctx>(null as never);
export const useAuth = () => useContext(AuthCtx);
const SCOPE_KEY = 'scopeSupplier';

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<string | null>(() => { try { return localStorage.getItem(SCOPE_KEY); } catch { return null; } });

  const applyScope = useCallback((u: User | null, id: string | null) => { setSupplierScope(u?.role === 'SUPER_ADMIN' ? id : null); }, []);
  useEffect(() => { applyScope(user, scope); }, [user, scope, applyScope]);

  useEffect(() => {
    setSessionLostHandler(() => { setAccessToken(null); setUser(null); qc.clear(); });
    refreshSession().then((r) => { if (r) { setUser(r.user); applyScope(r.user, scope); } }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ accessToken: string; user: User }>('/auth/login', { method: 'POST', body: { email, password } });
    setAccessToken(r.data.accessToken); applyScope(r.data.user, scope); setUser(r.data.user); qc.clear();
    return r.data.user;
  }, [qc, scope, applyScope]);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setAccessToken(null); setUser(null); qc.clear();
  }, [qc]);

  const setScopeSupplier = useCallback((id: string | null) => {
    try { id ? localStorage.setItem(SCOPE_KEY, id) : localStorage.removeItem(SCOPE_KEY); } catch { /* ignore */ }
    setSupplierScope(id); setScope(id); qc.invalidateQueries();
  }, [qc]);

  const value = useMemo<Ctx>(() => {
    const role = user?.role;
    return {
      user, loading, login, logout, setUser, scopeSupplier: scope, setScopeSupplier,
      can: { write: !!role, remove: role === 'SUPER_ADMIN' || role === 'SUPPLIER_ADMIN', manageUsers: role === 'SUPER_ADMIN' || role === 'SUPPLIER_ADMIN', manageSuppliers: role === 'SUPER_ADMIN', audit: role === 'SUPER_ADMIN' || role === 'SUPPLIER_ADMIN' },
    };
  }, [user, loading, login, logout, scope, setScopeSupplier]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

import type { DbContext } from './db.js';
export interface AuthUser { userId: string; email: string; role: 'SUPER_ADMIN' | 'SUPPLIER_ADMIN' | 'SUPPLIER_STAFF'; supplierId: string | null }
export interface Scope {
  role: AuthUser['role']; userId: string; email: string;
  /** Effective supplier. Non-super users: ALWAYS from the JWT. Super admin: optional X-Supplier-Id switcher. */
  supplierId: string | null;
  db: DbContext;
}
declare global {
  namespace Express {
    interface Request { auth?: AuthUser; scope?: Scope; requestId?: string; rawBody?: Buffer; guest?: import('./ops/guest.js').GuestCtx }
  }
}

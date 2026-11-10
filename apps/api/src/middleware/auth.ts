import type { NextFunction, Request, Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { config } from '../config.js';
import { forbidden, unauthorized } from '../http.js';
import type { AuthUser, Scope } from '../types.js';

const key = new TextEncoder().encode(config.JWT_ACCESS_SECRET);
const ISS = 'booking-admin', AUD = 'booking-admin-api';

export async function signAccessToken(u: AuthUser) {
  return new SignJWT({ role: u.role, supplierId: u.supplierId, email: u.email })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(u.userId).setIssuer(ISS).setAudience(AUD)
    .setIssuedAt().setExpirationTime(`${config.ACCESS_TOKEN_TTL_SECONDS}s`).sign(key);
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const h = req.get('authorization');
  if (!h?.startsWith('Bearer ')) throw unauthorized();
  try {
    const { payload } = await jwtVerify(h.slice(7), key, { issuer: ISS, audience: AUD, algorithms: ['HS256'] });
    const role = payload.role as AuthUser['role'];
    const supplierId = (payload.supplierId as string | null) ?? null;
    if (!['SUPER_ADMIN', 'SUPPLIER_ADMIN', 'SUPPLIER_STAFF'].includes(role)) throw new Error('bad role');
    if (role !== 'SUPER_ADMIN' && !supplierId) throw new Error('missing supplier');
    req.auth = { userId: String(payload.sub), email: String(payload.email), role, supplierId };
  } catch {
    throw unauthorized('Invalid or expired token');
  }
  req.scope = buildScope(req);
  next();
}

const uuid = z.string().uuid();
/**
 * THE SupplierID rule. Non-super users get their supplier from the verified JWT and nothing else:
 * any supplier id sent in a header, query or body is ignored. Only SUPER_ADMIN may choose a supplier (switcher).
 */
function buildScope(req: Request): Scope {
  const a = req.auth!;
  let supplierId = a.supplierId;
  if (a.role === 'SUPER_ADMIN') {
    const sw = req.get('x-supplier-id');
    if (sw) {
      const p = uuid.safeParse(sw);
      if (!p.success) throw forbidden('Invalid X-Supplier-Id');
      supplierId = p.data;
    }
  }
  return { role: a.role, userId: a.userId, email: a.email, supplierId, db: { role: a.role, supplierId: a.supplierId } };
}

export const requireRole = (...roles: AuthUser['role'][]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth || !roles.includes(req.auth.role)) throw forbidden();
  next();
};
export const notStaff = requireRole('SUPER_ADMIN', 'SUPPLIER_ADMIN');
export const superOnly = requireRole('SUPER_ADMIN');

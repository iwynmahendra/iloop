import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { withSystem, type Tx } from '../db.js';
import { AppError, ok, unauthorized, forbidden } from '../http.js';
import { authenticate, signAccessToken } from '../middleware/auth.js';
import { CSRF_COOKIE, csrfProtect, newCsrfToken } from '../middleware/csrf.js';
import { writeAudit } from '../crud/audit.js';
import { mailer } from '../mail.js';
import type { AuthUser } from '../types.js';

export const REFRESH_COOKIE = 'refresh_token';
const COOKIE_PATH = '/api/v1/auth';
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const BCRYPT_COST = 12;
// Compared when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

export const passwordSchema = z.string().min(10, 'At least 10 characters').max(128)
  .regex(/[A-Za-z]/, 'Must contain a letter').regex(/\d/, 'Must contain a number');

const limiter = (limit: number) => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, skip: () => config.NODE_ENV === 'test',
  handler: (_req, res) => { res.status(429).json({ success: false, data: null, message: 'Too many attempts, try again later', errors: null, meta: null }); } });

type DbUser = NonNullable<Awaited<ReturnType<Tx['user']['findFirst']>>>;
const userView = (u: DbUser, supplier: { id: string; code: string; name: string } | null) => ({
  id: u.id, email: u.email, name: u.name, role: u.role, supplierId: u.supplierId, supplier, mustChangePassword: u.mustChangePassword,
});
const ctxOf = (req: Request) => ({ ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, requestId: req.requestId ?? null });

function setAuthCookies(res: Response, refreshToken: string) {
  const base = { secure: config.COOKIE_SECURE, sameSite: 'strict' as const, domain: config.COOKIE_DOMAIN || undefined };
  const maxAge = config.REFRESH_TOKEN_TTL_DAYS * 86400 * 1000;
  res.cookie(REFRESH_COOKIE, refreshToken, { ...base, httpOnly: true, path: COOKIE_PATH, maxAge });
  res.cookie(CSRF_COOKIE, newCsrfToken(), { ...base, httpOnly: false, path: '/', maxAge });
}
function clearAuthCookies(res: Response) {
  const base = { secure: config.COOKIE_SECURE, sameSite: 'strict' as const, domain: config.COOKIE_DOMAIN || undefined };
  res.clearCookie(REFRESH_COOKIE, { ...base, httpOnly: true, path: COOKIE_PATH });
  res.clearCookie(CSRF_COOKIE, { ...base, path: '/' });
}

async function issueRefresh(tx: Tx, userId: string, familyId: string, req: Request) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const row = await tx.refreshToken.create({ data: {
    userId, familyId, tokenHash: sha256(raw), ip: req.ip ?? null, userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
    expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86400 * 1000),
  } });
  return { raw, id: row.id };
}

async function loadSupplier(tx: Tx, supplierId: string | null) {
  if (!supplierId) return null;
  return tx.supplier.findFirst({ where: { id: supplierId, deletedAt: null }, select: { id: true, code: true, name: true, status: true } });
}
const accessPayload = async (u: DbUser): Promise<AuthUser> => ({ userId: u.id, email: u.email, role: u.role, supplierId: u.supplierId });

const loginBody = z.object({ email: z.string().email().max(254).transform((s) => s.toLowerCase().trim()), password: z.string().min(1).max(128) });

export const authRouter = Router();

authRouter.post('/login', limiter(20), async (req, res) => {
  const { email, password } = loginBody.parse(req.body);
  type Outcome = { fail: { status: number; message: string } } | { user: DbUser; supplier: Awaited<ReturnType<typeof loadSupplier>>; refresh: string };
  const out: Outcome = await withSystem(async (tx) => {
    const c = ctxOf(req);
    const user = await tx.user.findFirst({ where: { email, deletedAt: null } });
    const passOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    const note = async (success: boolean, reason?: string) => {
      await tx.loginAttempt.create({ data: { email, userId: user?.id ?? null, ip: c.ip, success, reason: reason ?? null } });
      if (!success) await writeAudit(tx, { action: 'LOGIN_FAILED', entityType: 'user', entityId: user?.id, supplierId: user?.supplierId, userEmail: email, after: { reason }, ...c });
    };
    const generic = { fail: { status: 401, message: 'Invalid email or password' } } as const;
    if (!user) { await note(false, 'unknown_email'); return generic; }
    if (user.lockedUntil && user.lockedUntil > new Date()) { await note(false, 'locked'); return { fail: { status: 423, message: 'Account is temporarily locked. Try again later or reset your password.' } }; }
    if (!passOk) {
      const count = user.failedLoginCount + 1;
      const lock = count >= config.MAX_FAILED_LOGINS;
      await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: lock ? 0 : count, lockedUntil: lock ? new Date(Date.now() + config.LOCK_MINUTES * 60000) : null } });
      await note(false, lock ? 'locked_now' : 'bad_password');
      return generic;
    }
    if (user.status !== 'ACTIVE') { await note(false, 'disabled'); return { fail: { status: 403, message: 'This account is disabled' } }; }
    const supplier = await loadSupplier(tx, user.supplierId);
    if (user.role !== 'SUPER_ADMIN' && supplier?.status !== 'ACTIVE') { await note(false, 'supplier_inactive'); return { fail: { status: 403, message: 'Your supplier account is not active' } }; }
    await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const refresh = await issueRefresh(tx, user.id, crypto.randomUUID(), req);
    await note(true);
    await writeAudit(tx, { action: 'LOGIN', entityType: 'user', entityId: user.id, supplierId: user.supplierId, userId: user.id, userEmail: user.email, ...c });
    return { user, supplier, refresh: refresh.raw };
  });
  if ('fail' in out) throw new AppError(out.fail.status, out.fail.message);
  setAuthCookies(res, out.refresh);
  ok(res, { accessToken: await signAccessToken(await accessPayload(out.user)), expiresIn: config.ACCESS_TOKEN_TTL_SECONDS, user: userView(out.user, out.supplier) }, 'Logged in');
});

authRouter.post('/refresh', csrfProtect, async (req, res) => {
  const raw = String(req.cookies?.[REFRESH_COOKIE] ?? '');
  if (!raw) throw unauthorized('No session');
  type Outcome = { fail: string } | { user: DbUser; supplier: Awaited<ReturnType<typeof loadSupplier>>; refresh: string };
  const out: Outcome = await withSystem(async (tx) => {
    const tok = await tx.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (!tok) return { fail: 'Invalid session' };
    if (tok.revokedAt) { // a rotated token was presented again: assume theft and kill the whole family
      await tx.refreshToken.updateMany({ where: { familyId: tok.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      return { fail: 'Session was revoked' };
    }
    if (tok.expiresAt < new Date()) return { fail: 'Session expired' };
    const user = await tx.user.findFirst({ where: { id: tok.userId, deletedAt: null } });
    const supplier = user ? await loadSupplier(tx, user.supplierId) : null;
    if (!user || user.status !== 'ACTIVE' || (user.role !== 'SUPER_ADMIN' && supplier?.status !== 'ACTIVE')) {
      await tx.refreshToken.updateMany({ where: { familyId: tok.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      return { fail: 'Session is no longer valid' };
    }
    const next = await issueRefresh(tx, user.id, tok.familyId, req);
    await tx.refreshToken.update({ where: { id: tok.id }, data: { revokedAt: new Date(), replacedById: next.id } });
    return { user, supplier, refresh: next.raw };
  });
  if ('fail' in out) { clearAuthCookies(res); throw unauthorized(out.fail); }
  setAuthCookies(res, out.refresh);
  ok(res, { accessToken: await signAccessToken(await accessPayload(out.user)), expiresIn: config.ACCESS_TOKEN_TTL_SECONDS, user: userView(out.user, out.supplier) }, 'Refreshed');
});

authRouter.post('/logout', csrfProtect, async (req, res) => {
  const raw = String(req.cookies?.[REFRESH_COOKIE] ?? '');
  if (raw) await withSystem(async (tx) => {
    const tok = await tx.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (!tok) return;
    await tx.refreshToken.updateMany({ where: { familyId: tok.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    const u = await tx.user.findUnique({ where: { id: tok.userId } });
    await writeAudit(tx, { action: 'LOGOUT', entityType: 'user', entityId: tok.userId, supplierId: u?.supplierId, userId: tok.userId, userEmail: u?.email, ...ctxOf(req) });
  });
  clearAuthCookies(res);
  ok(res, null, 'Logged out');
});

authRouter.get('/me', authenticate, async (req, res) => {
  const out = await withSystem(async (tx) => {
    const u = await tx.user.findFirst({ where: { id: req.auth!.userId, deletedAt: null } });
    if (!u || u.status !== 'ACTIVE') return null;
    return userView(u, await loadSupplier(tx, u.supplierId));
  });
  if (!out) throw unauthorized('Account not available');
  ok(res, out);
});

authRouter.post('/forgot-password', limiter(10), async (req, res) => {
  const { email } = z.object({ email: z.string().email().max(254).transform((s) => s.toLowerCase().trim()) }).parse(req.body);
  const msg = 'If that email exists, a reset link has been sent.';
  let raw: string | null = null;
  await withSystem(async (tx) => {
    const u = await tx.user.findFirst({ where: { email, deletedAt: null, status: 'ACTIVE' } });
    if (!u) return;
    await tx.passwordResetToken.updateMany({ where: { userId: u.id, usedAt: null }, data: { usedAt: new Date() } });
    raw = crypto.randomBytes(32).toString('base64url');
    await tx.passwordResetToken.create({ data: { userId: u.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 30 * 60000) } });
  });
  if (raw) await mailer.send(email, 'Reset your password', `Use this link within 30 minutes: ${config.APP_URL}/reset-password?token=${raw}`);
  ok(res, null, msg); // same answer whether or not the email exists
});

authRouter.post('/reset-password', limiter(10), async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(20).max(200), password: passwordSchema }).parse(req.body);
  const done = await withSystem(async (tx) => {
    const t = await tx.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!t || t.usedAt || t.expiresAt < new Date()) return false;
    const u = await tx.user.findUnique({ where: { id: t.userId } });
    if (!u) return false;
    await tx.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(password, BCRYPT_COST), passwordChangedAt: new Date(), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null } });
    await tx.passwordResetToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
    await tx.refreshToken.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, { action: 'PASSWORD_RESET', entityType: 'user', entityId: u.id, supplierId: u.supplierId, userId: u.id, userEmail: u.email, ...ctxOf(req) });
    return true;
  });
  if (!done) throw new AppError(400, 'This reset link is invalid or has expired');
  clearAuthCookies(res);
  ok(res, null, 'Password updated. Please sign in.');
});

authRouter.post('/change-password', authenticate, limiter(10), async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema }).parse(req.body);
  if (currentPassword === newPassword) throw new AppError(422, 'New password must be different');
  const good = await withSystem(async (tx) => {
    const u = await tx.user.findFirst({ where: { id: req.auth!.userId, deletedAt: null } });
    if (!u || !(await bcrypt.compare(currentPassword, u.passwordHash))) return false;
    await tx.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST), passwordChangedAt: new Date(), mustChangePassword: false } });
    await tx.refreshToken.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, { action: 'PASSWORD_RESET', entityType: 'user', entityId: u.id, supplierId: u.supplierId, userId: u.id, userEmail: u.email, after: { via: 'change-password' }, ...ctxOf(req) });
    return true;
  });
  if (!good) throw forbidden('Current password is incorrect');
  clearAuthCookies(res);
  ok(res, null, 'Password changed. Please sign in again.');
});

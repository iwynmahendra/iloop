import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { forbidden } from '../http.js';

export const CSRF_COOKIE = 'csrf_token';
export const newCsrfToken = () => crypto.randomBytes(24).toString('base64url');

const allowedOrigins = config.CORS_ORIGIN.split(',').map((s) => s.trim());

/** Double-submit cookie + Origin check, for the endpoints that rely on the refresh cookie (refresh, logout). */
export function csrfProtect(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get('origin');
  if (origin && !allowedOrigins.includes(origin)) throw forbidden('Origin not allowed');
  const cookie = String(req.cookies?.[CSRF_COOKIE] ?? '');
  const header = String(req.get('x-csrf-token') ?? '');
  const a = Buffer.from(cookie), b = Buffer.from(header);
  if (!cookie || a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw forbidden('CSRF token missing or invalid');
  next();
}

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';

const WEB_APPS = ['hotel', 'trips', 'transport', 'club', 'operator'] as const;
const APP_LABEL: Record<string, string> = { hotel: 'Hotel admin', trips: 'Trips admin', transport: 'Transport admin', club: 'Club admin', operator: 'Operator console' };
import { errorHandler, notFound } from './http.js';
import { logger } from './logger.js';
import { authenticate, notStaff } from './middleware/auth.js';
import { crudRouter } from './crud/router.js';
import { resources } from './crud/resources.generated.js';
import { authRouter } from './modules/auth.js';
import { auditRouter } from './modules/auditLogs.js';
import { dashboardRouter } from './modules/dashboard.js';
import { mediaRouter } from './modules/media.js';
import { suppliersRouter } from './modules/suppliers.js';
import { usersRouter } from './modules/users.js';
import { buildOpenApi } from './openapi.js';
import { bookingRouter } from './booking/router.js';
import { inboundRouter, integrationsRouter, pmsReadRouter } from './integrations/router.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false);
  app.use((req, res, next) => { req.requestId = (req.get('x-request-id') ?? '').slice(0, 64) || crypto.randomUUID(); res.setHeader('X-Request-Id', req.requestId); next(); });
  app.use(pinoHttp({ logger, genReqId: (req) => (req as any).requestId, autoLogging: { ignore: (req) => req.url === '/health' } }));
  // HSTS and upgrade-insecure-requests only make sense (and are only safe) when the site is served over HTTPS.
  app.use(helmet({ hsts: config.COOKIE_SECURE, crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': config.COOKIE_SECURE ? [] : null, 'default-src': ["'self'"], 'img-src': ["'self'", 'data:', 'https:'], 'script-src': ["'self'", "'unsafe-inline'"], 'style-src': ["'self'", "'unsafe-inline'"] } } }));
  const origins = config.CORS_ORIGIN.split(',').map((s) => s.trim());
  app.use(cors({ origin: (o, cb) => cb(null, !o || origins.includes(o)), credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Supplier-Id', 'X-Request-Id'], exposedHeaders: ['X-Request-Id', 'Content-Disposition'] }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { (req as { rawBody?: Buffer }).rawBody = buf; } }));
  app.use(rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false, skip: (r) => config.NODE_ENV === 'test' || r.path === '/health' }));

  app.get('/health', (_req, res) => { res.json({ ok: true }); });
  if (config.STORAGE_DRIVER === 'local') {
    app.use(config.PUBLIC_UPLOAD_URL, express.static(path.resolve(config.UPLOAD_DIR), { index: false, dotfiles: 'deny', setHeaders: (res) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
  }

  const v1 = Router();
  v1.use('/auth', authRouter);
  v1.use(inboundRouter); // public, signed: providers tell us about reservations and rooms
  v1.get('/openapi.json', (_req, res) => { res.json(buildOpenApi()); });

  const secured = Router();
  secured.use(authenticate);
  secured.use('/suppliers', suppliersRouter);
  secured.use('/users', usersRouter);
  secured.use('/audit-logs', auditRouter);
  secured.use('/dashboard', dashboardRouter);
  secured.use((req, res, next) => (/^\/(integrations|integration-events|api-keys|webhooks)(\/|$)/.test(req.path) ? notStaff(req, res, next) : next())); // these four are admin only
  secured.use(integrationsRouter);
  secured.use(pmsReadRouter); // the PMS mirror: Front desk and Rooms read it
  secured.use(bookingRouter); // bookings, customers, payments, availability, boards, reports
  secured.use('/shared/media-assets', mediaRouter); // before the generic router, see media.ts
  for (const r of resources) secured.use(`/${r.group}/${r.path}`, crudRouter(r));
  v1.use(secured);
  app.use('/api/v1', v1);

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(undefined, { swaggerUrl: '/api/v1/openapi.json' }));
  // Single-container deployment: serve every built admin app from the same origin (the auth cookies are SameSite=Strict).
  // Each app lives in apps/<key>/dist and is mounted at /<key>/. WEB_ROOT is the folder that holds the app folders.
  const webRoot = path.resolve(process.env.WEB_ROOT ?? 'apps');
  const mounted: string[] = [];
  for (const key of WEB_APPS) {
    const dist = path.join(webRoot, key, 'dist');
    if (!fs.existsSync(path.join(dist, 'index.html'))) continue;
    mounted.push(key);
    app.use(`/${key}`, express.static(dist, { index: false, maxAge: '1h', setHeaders: (res, p) => { if (p.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
    // client-side routes: anything under /<key> without a file extension gets the app shell
    app.get(new RegExp(`^/${key}(?:/(?!.*\\.[A-Za-z0-9]+$).*)?$`), (_req, res) => { res.sendFile(path.join(dist, 'index.html')); });
  }
  if (mounted.length) {
    app.get('/', (_req, res) => {
      res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booking platform</title>
<style>body{font:16px system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#f5f6f8;color:#1b2230}main{padding:2rem;max-width:30rem;width:100%}a{display:block;padding:.9rem 1rem;margin:.5rem 0;background:#fff;border:1px solid #d9dde5;border-radius:.6rem;color:inherit;text-decoration:none}a:hover{border-color:#2c4fd6}small{color:#667}</style>
<main><h1>Booking platform</h1>${mounted.map((k) => `<a href="/${k}/">${APP_LABEL[k]}<br><small>/${k}/</small></a>`).join('')}<a href="/api/docs">API documentation<br><small>/api/docs</small></a></main>`);
    });
  }
  app.use((_req, _res, next) => next(notFound('Route not found')));
  app.use(errorHandler);
  return app;
}

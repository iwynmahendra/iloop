import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { withDb } from '../db.js';
import { badRequest, conflict, notFound, ok } from '../http.js';
import { writeAudit } from '../crud/audit.js';
import { actorOf, needSupplier, idOf } from '../booking/util.js';
import { pmsFor, PMS_PROVIDERS, CONFIG_KEYS, SECRETISH } from './registry.js';
import { API_SCOPES, endpointSecret, inboundSecret, newApiKey, signatureHeader, verifySignature } from './security.js';
import { ctxOf, processEvents, syncPms } from './worker.js';
import { TOPICS } from './events.js';

export const integrationsRouter = Router();
type H = (req: Request) => Promise<{ data: unknown; message?: string; status?: number; meta?: { page: number; limit: number; total: number } }>;
const h = (fn: H): RequestHandler => async (req, res, next) => { try { const r = await fn(req); ok(res, r.data, r.message ?? 'OK', r.meta, r.status ?? 200); } catch (e) { next(e); } };
const tx = <T>(req: Request, fn: (t: Parameters<Parameters<typeof withDb>[1]>[0]) => Promise<T>) => withDb(req.scope!.db, fn);
const aud = (t: Parameters<Parameters<typeof withDb>[1]>[0], req: Request, action: 'CREATE' | 'UPDATE' | 'DELETE', type: string, id: string, after?: unknown) => { const a = actorOf(req); return writeAudit(t, { action, entityType: type, entityId: id, supplierId: req.scope!.supplierId, after, userId: a.userId, userEmail: a.email, ip: a.ip, userAgent: a.userAgent, requestId: a.requestId }); };

const secretRef = z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/, 'Use a server variable name like OPERA_CLIENT_SECRET').nullable().optional();
/** config holds settings only. Anything that looks like a credential is refused. */
const configSchema = (kind: string) => z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean()])).superRefine((c, ctx) => {
  const allowed = CONFIG_KEYS[kind === 'PMS' ? 'pms' : 'other']!;
  for (const k of Object.keys(c)) {
    if (SECRETISH.test(k)) ctx.addIssue({ code: 'custom', message: `"${k}" looks like a secret. Keep secrets in the server environment and give its name in secretRef.` });
    else if (!allowed.includes(k)) ctx.addIssue({ code: 'custom', message: `"${k}" is not a setting of this connection` });
  }
  if (typeof c.baseUrl === 'string' && !/^https:\/\//.test(c.baseUrl)) ctx.addIssue({ code: 'custom', message: 'baseUrl must start with https://' });
});
const createConn = z.object({ kind: z.enum(['PMS', 'CHANNEL', 'PAYMENT', 'EMAIL', 'AI']), provider: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/), name: z.string().min(1).max(80), config: z.record(z.string(), z.unknown()).default({}), secretRef }).strict();
const patchConn = z.object({ name: z.string().min(1).max(80).optional(), enabled: z.boolean().optional(), config: z.record(z.string(), z.unknown()).optional(), secretRef }).strict();
const pub = (c: any) => ({ id: c.id, kind: c.kind, provider: c.provider, name: c.name, status: c.status, enabled: c.enabled, config: c.config, secretRef: c.secretRef, lastOkAt: c.lastOkAt, lastSyncAt: c.lastSyncAt, lastError: c.lastError, createdAt: c.createdAt, inboundUrl: `/api/v1/integrations/inbound/${c.id}` });

integrationsRouter.get('/integrations', h(async (req) => ({ data: (await tx(req, (t) => t.integrationConnection.findMany({ where: req.scope!.supplierId ? { supplierId: req.scope!.supplierId } : {}, orderBy: [{ kind: 'asc' }, { name: 'asc' }] }))).map(pub) })));

integrationsRouter.post('/integrations', h(async (req) => {
  const sid = needSupplier(req.scope!), b = createConn.parse(req.body);
  if (b.kind === 'PMS' && !PMS_PROVIDERS.includes(b.provider as never)) throw badRequest(`PMS provider must be one of ${PMS_PROVIDERS.join(', ')}`);
  const cfg = configSchema(b.kind).parse(b.config);
  const row = await tx(req, async (t) => {
    if (await t.integrationConnection.findFirst({ where: { supplierId: sid, kind: b.kind, provider: b.provider } })) throw conflict('This provider is already connected for this hotel');
    const c = await t.integrationConnection.create({ data: { supplierId: sid, kind: b.kind, provider: b.provider, name: b.name, config: cfg, secretRef: b.secretRef ?? null } });
    await aud(t, req, 'CREATE', 'IntegrationConnection', c.id, { kind: c.kind, provider: c.provider });
    return c;
  });
  return { data: { ...pub(row), inboundSecret: inboundSecret(row.id) }, message: 'Created. Copy the inbound secret now if the provider will send us events.', status: 201 };
}));

integrationsRouter.patch('/integrations/:id', h(async (req) => {
  const id = idOf(req), b = patchConn.parse(req.body);
  const row = await tx(req, async (t) => {
    const cur = await t.integrationConnection.findFirst({ where: { id } });
    if (!cur) throw notFound();
    const cfg = b.config ? configSchema(cur.kind).parse(b.config) : undefined;
    const c = await t.integrationConnection.update({ where: { id }, data: { ...(b.name && { name: b.name }), ...(b.enabled !== undefined && { enabled: b.enabled, ...(b.enabled ? {} : { status: 'DISABLED' as const }) }), ...(cfg && { config: cfg }), ...(b.secretRef !== undefined && { secretRef: b.secretRef }) } });
    await aud(t, req, 'UPDATE', 'IntegrationConnection', id, { enabled: c.enabled });
    return c;
  });
  return { data: pub(row) };
}));

integrationsRouter.delete('/integrations/:id', h(async (req) => {
  const id = idOf(req);
  await tx(req, async (t) => { const r = await t.integrationConnection.deleteMany({ where: { id } }); if (!r.count) throw notFound(); await aud(t, req, 'DELETE', 'IntegrationConnection', id); });
  return { data: { id }, message: 'Removed. Mirrored PMS data for this connection was removed with it.' };
}));

integrationsRouter.post('/integrations/:id/test', h(async (req) => {
  const id = idOf(req);
  return { data: await tx(req, async (t) => {
    const c = await t.integrationConnection.findFirst({ where: { id } });
    if (!c) throw notFound();
    if (c.kind !== 'PMS') { return { ok: false, message: 'Test is available for PMS connections in this build.' }; }
    let r: { ok: boolean; message: string };
    try { r = await pmsFor(c.provider).testConnection(ctxOf(c)); } catch (e) { r = { ok: false, message: e instanceof Error ? e.message : 'Test failed' }; }
    await t.integrationConnection.update({ where: { id }, data: r.ok ? { status: 'CONNECTED', lastOkAt: new Date(), lastError: null } : { status: 'ERROR', lastError: r.message } });
    return r;
  }) };
}));

integrationsRouter.post('/integrations/:id/sync', h(async (req) => {
  const id = idOf(req);
  return { data: await tx(req, async (t) => {
    const c = await t.integrationConnection.findFirst({ where: { id } });
    if (!c) throw notFound();
    if (c.kind !== 'PMS' || !c.enabled) throw badRequest('Only an enabled PMS connection can be synced');
    try { return await syncPms(t, c); } catch (e) { throw badRequest(e instanceof Error ? e.message : 'Sync failed'); }
  }) };
}));

/* ---- events ---- */
const evQ = z.object({ status: z.enum(['PENDING', 'DONE', 'FAILED', 'DEAD', 'SKIPPED']).optional(), direction: z.enum(['IN', 'OUT']).optional(), topic: z.string().max(60).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });
integrationsRouter.get('/integration-events', h(async (req) => {
  const q = evQ.parse(req.query), s = req.scope!, where = { ...(s.supplierId ? { supplierId: s.supplierId } : {}), ...(q.status && { status: q.status }), ...(q.direction && { direction: q.direction }), ...(q.topic && { topic: q.topic }) };
  const [rows, total] = await tx(req, (t) => Promise.all([t.integrationEvent.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit, select: { id: true, direction: true, topic: true, status: true, attempts: true, lastError: true, nextAttemptAt: true, createdAt: true, doneAt: true, connectionId: true, webhookId: true } }), t.integrationEvent.count({ where })]));
  return { data: rows, meta: { page: q.page, limit: q.limit, total } };
}));
integrationsRouter.post('/integration-events/:id/retry', h(async (req) => {
  const id = idOf(req);
  await tx(req, async (t) => { const r = await t.integrationEvent.updateMany({ where: { id, status: { in: ['DEAD', 'FAILED', 'SKIPPED'] } }, data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lastError: null } }); if (!r.count) throw conflict('Only a failed or dead event can be retried'); });
  return { data: { id }, message: 'Queued again' };
}));
/** Runs the worker once for the caller. The scheduled worker does this every few seconds; this is for tests and the "run now" button. */
integrationsRouter.post('/integration-events/run', h(async () => ({ data: { delivered: await processEvents(50) } })));

/* ---- api keys ---- */
integrationsRouter.get('/api-keys', h(async (req) => ({ data: await tx(req, (t) => t.apiKey.findMany({ where: req.scope!.supplierId ? { supplierId: req.scope!.supplierId } : {}, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, revokedAt: true, createdAt: true } })) })));
integrationsRouter.post('/api-keys', h(async (req) => {
  const sid = needSupplier(req.scope!), b = z.object({ name: z.string().min(1).max(80), scopes: z.array(z.enum(API_SCOPES)).min(1) }).strict().parse(req.body), k = newApiKey();
  const row = await tx(req, async (t) => { const r = await t.apiKey.create({ data: { supplierId: sid, name: b.name, prefix: k.prefix, keyHash: k.hash, scopes: b.scopes } }); await aud(t, req, 'CREATE', 'ApiKey', r.id, { name: b.name, scopes: b.scopes }); return r; });
  return { data: { id: row.id, name: row.name, prefix: row.prefix, scopes: row.scopes, key: k.key }, message: 'Copy the key now. It is shown only once.', status: 201 };
}));
integrationsRouter.delete('/api-keys/:id', h(async (req) => {
  const id = idOf(req);
  await tx(req, async (t) => { const r = await t.apiKey.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } }); if (!r.count) throw notFound(); await aud(t, req, 'DELETE', 'ApiKey', id); });
  return { data: { id }, message: 'Revoked' };
}));

/* ---- webhooks ---- */
const hookBody = z.object({ url: z.string().url().max(500).refine((u) => u.startsWith('https://'), 'Use an https:// address'), description: z.string().max(120).optional(), topics: z.array(z.enum([...TOPICS, '*'] as [string, ...string[]])).min(1), active: z.boolean().optional() }).strict();
integrationsRouter.get('/webhooks', h(async (req) => ({ data: await tx(req, (t) => t.webhookEndpoint.findMany({ where: req.scope!.supplierId ? { supplierId: req.scope!.supplierId } : {}, orderBy: { createdAt: 'desc' } })) })));
integrationsRouter.post('/webhooks', h(async (req) => {
  const sid = needSupplier(req.scope!), b = hookBody.parse(req.body);
  const row = await tx(req, async (t) => { const r = await t.webhookEndpoint.create({ data: { supplierId: sid, url: b.url, description: b.description, topics: b.topics, active: b.active ?? true } }); await aud(t, req, 'CREATE', 'WebhookEndpoint', r.id, { url: b.url }); return r; });
  return { data: { ...row, secret: endpointSecret(row.id) }, message: 'Copy the signing secret now.', status: 201 };
}));
integrationsRouter.patch('/webhooks/:id', h(async (req) => {
  const id = idOf(req), b = hookBody.partial().parse(req.body);
  const row = await tx(req, async (t) => { const r = await t.webhookEndpoint.updateMany({ where: { id }, data: b }); if (!r.count) throw notFound(); await aud(t, req, 'UPDATE', 'WebhookEndpoint', id, b); return t.webhookEndpoint.findFirst({ where: { id } }); });
  return { data: row };
}));
integrationsRouter.delete('/webhooks/:id', h(async (req) => {
  const id = idOf(req);
  await tx(req, async (t) => { const r = await t.webhookEndpoint.deleteMany({ where: { id } }); if (!r.count) throw notFound(); await aud(t, req, 'DELETE', 'WebhookEndpoint', id); });
  return { data: { id } };
}));
integrationsRouter.post('/webhooks/:id/test', h(async (req) => {
  const id = idOf(req);
  await tx(req, async (t) => { const w = await t.webhookEndpoint.findFirst({ where: { id } }); if (!w) throw notFound(); await t.integrationEvent.create({ data: { supplierId: w.supplierId, webhookId: w.id, direction: 'OUT', topic: 'webhook.test', idempotencyKey: `test:${id}:${Date.now()}`, payload: { hello: 'world' } } }); });
  return { data: { id }, message: 'A test event is queued' };
}));
integrationsRouter.get('/webhooks/:id/secret', h(async (req) => { const id = idOf(req); const w = await tx(req, (t) => t.webhookEndpoint.findFirst({ where: { id } })); if (!w) throw notFound(); return { data: { secret: endpointSecret(w.id) } }; }));

/* ---- the PMS mirror (read) ---- */
export const pmsReadRouter = Router();
const resQ = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), status: z.enum(['RESERVED', 'IN_HOUSE', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']).optional(), q: z.string().max(80).optional() });
/** Arrivals (arrival in range), departures (departure in range) and in house are all this one list with different filters. */
pmsReadRouter.get('/pms/reservations', h(async (req) => {
  const q = resQ.parse(req.query), s = req.scope!;
  const rows = await tx(req, (t) => t.pmsReservation.findMany({ where: { ...(s.supplierId ? { supplierId: s.supplierId } : {}), ...(q.status && { status: q.status }), ...(q.from && { departure: { gte: new Date(q.from + 'T00:00:00Z') } }), ...(q.to && { arrival: { lte: new Date(q.to + 'T00:00:00Z') } }), ...(q.q && { OR: [{ guestName: { contains: q.q, mode: 'insensitive' as const } }, { confirmationNo: { contains: q.q, mode: 'insensitive' as const } }, { roomNo: q.q }] }) }, orderBy: [{ arrival: 'asc' }, { guestName: 'asc' }], take: 500 }));
  return { data: rows };
}));
pmsReadRouter.get('/pms/rooms', h(async (req) => ({ data: await tx(req, (t) => t.pmsRoomState.findMany({ where: req.scope!.supplierId ? { supplierId: req.scope!.supplierId } : {}, orderBy: { roomNo: 'asc' }, take: 1000 })) })));

/* ---- public: a provider (or its middleware) tells us something. Signed, replay-proof, idempotent. ---- */
export const inboundRouter = Router();
inboundRouter.post('/integrations/inbound/:id', async (req, res, next) => {
  try {
    const id = idOf(req), raw = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '';
    if (!verifySignature(inboundSecret(id), req.get('x-signature'), raw)) { res.status(401).json({ success: false, data: null, message: 'Bad signature', errors: null, meta: null }); return; }
    const b = z.object({ id: z.string().min(1).max(120), topic: z.enum(['pms.reservation', 'pms.room']), data: z.record(z.string(), z.unknown()) }).strict().parse(req.body);
    const r = await withDb({ role: 'SUPER_ADMIN', supplierId: null }, async (t) => {
      const c = await t.integrationConnection.findFirst({ where: { id, enabled: true } });
      if (!c) throw notFound();
      const made = await t.integrationEvent.createMany({ data: [{ supplierId: c.supplierId, connectionId: c.id, direction: 'IN', topic: b.topic, idempotencyKey: b.id, payload: b.data as object }], skipDuplicates: true });
      return made.count;
    });
    ok(res, { accepted: r === 1, duplicate: r === 0 }, r ? 'Accepted' : 'Already received', undefined, 202);
  } catch (e) { next(e); }
});
export { signatureHeader };

import { withDb, type Tx } from '../db.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { AdapterError, type ConnectionCtx, type PmsReservation } from './adapter.js';
import { backoffSeconds, MAX_EVENT_ATTEMPTS } from './events.js';
import { pmsFor } from './registry.js';
import { endpointSecret, signatureHeader } from './security.js';

const SYS = { role: 'SUPER_ADMIN', supplierId: null } as const;
export const ctxOf = (c: { id: string; supplierId: string; provider: string; config: unknown; secretRef: string | null }): ConnectionCtx => ({ id: c.id, supplierId: c.supplierId, provider: c.provider, config: (c.config ?? {}) as Record<string, unknown>, secretRef: c.secretRef });
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ymd = (x: Date) => x.toISOString().slice(0, 10);

/** Copies the PMS into our mirror (reservations and room state). Safe to run again and again. */
export async function syncPms(tx: Tx, conn: { id: string; supplierId: string; provider: string; config: unknown; secretRef: string | null }) {
  const a = pmsFor(conn.provider), c = ctxOf(conn);
  if (!a.capabilities.pullReservations && !a.capabilities.roomStatus) throw new AdapterError(`${conn.provider} cannot sync in this build`, false);
  const cfg = c.config, back = Number(cfg.syncDaysBack ?? 7), ahead = Number(cfg.syncDaysAhead ?? 30);
  const from = ymd(new Date(Date.now() - back * 864e5)), to = ymd(new Date(Date.now() + ahead * 864e5));
  let n = 0, rooms = 0;
  if (a.capabilities.pullReservations) {
    let cursor: string | undefined;
    do {
      const page = await a.pullReservations(c, { from, to, cursor });
      for (const r of page.items) { await upsertReservation(tx, conn, r); n++; }
      cursor = page.cursor;
    } while (cursor);
  }
  if (a.capabilities.roomStatus) {
    for (const r of await a.pullRoomStatus(c)) {
      await tx.pmsRoomState.upsert({ where: { connectionId_roomNo: { connectionId: conn.id, roomNo: r.roomNo } }, create: { supplierId: conn.supplierId, connectionId: conn.id, roomNo: r.roomNo, foStatus: r.foStatus, hkStatus: r.hkStatus }, update: { foStatus: r.foStatus, hkStatus: r.hkStatus, syncedAt: new Date() } });
      rooms++;
    }
  }
  await tx.integrationConnection.update({ where: { id: conn.id }, data: { lastSyncAt: new Date(), lastOkAt: new Date(), lastError: null, status: 'CONNECTED' } });
  return { reservations: n, rooms };
}

export async function upsertReservation(tx: Tx, conn: { id: string; supplierId: string }, r: PmsReservation) {
  const data = { confirmationNo: r.confirmationNo ?? null, guestName: r.guestName.slice(0, 160), guestEmail: r.guestEmail ?? null, guestPhone: r.guestPhone ?? null, roomType: r.roomType ?? null, roomNo: r.roomNo ?? null, arrival: d(r.arrival), departure: d(r.departure), adults: r.adults, children: r.children, status: r.status, rateCode: r.rateCode ?? null, balance: r.balance ?? 0, syncedAt: new Date() };
  await tx.pmsReservation.upsert({ where: { connectionId_externalId: { connectionId: conn.id, externalId: r.externalId } }, create: { supplierId: conn.supplierId, connectionId: conn.id, externalId: r.externalId, ...data }, update: data });
}

async function deliverWebhook(tx: Tx, e: { id: string; supplierId: string; webhookId: string | null; topic: string; payload: unknown; createdAt: Date }) {
  const h = await tx.webhookEndpoint.findFirst({ where: { id: e.webhookId ?? '', active: true } });
  if (!h) return 'skip' as const;
  const body = JSON.stringify({ id: e.id, topic: e.topic, createdAt: e.createdAt.toISOString(), data: e.payload });
  const res = await fetch(h.url, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'booking-admin-webhooks/1', 'x-event-topic': e.topic, 'x-event-id': e.id, 'x-signature': signatureHeader(endpointSecret(h.id), body) }, body, redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Webhook answered ${res.status}`);
  return 'done' as const;
}

async function runCommand(tx: Tx, e: { supplierId: string; connectionId: string | null; topic: string; payload: unknown }) {
  const conn = await tx.integrationConnection.findFirst({ where: { id: e.connectionId ?? '' } });
  if (!conn || !conn.enabled) return 'skip' as const;
  const a = pmsFor(conn.provider), c = ctxOf(conn), p = (e.payload ?? {}) as Record<string, any>;
  if (e.topic === 'pms.post_charge') { if (!a.capabilities.postCharge) return 'skip' as const; const r = await a.postCharge(c, { externalReservationId: String(p.externalReservationId ?? ''), code: String(p.code ?? 'MISC'), amount: Number(p.amount), currency: String(p.currency ?? 'IDR'), description: String(p.description ?? ''), idempotencyKey: String(p.idempotencyKey) }); if (p.bookingId) await tx.externalRef.upsert({ where: { connectionId_entityType_entityId: { connectionId: conn.id, entityType: 'charge', entityId: p.bookingId } }, create: { supplierId: conn.supplierId, connectionId: conn.id, entityType: 'charge', entityId: p.bookingId, externalId: r.externalId }, update: { externalId: r.externalId } }); }
  else if (e.topic === 'pms.check_in') { if (!a.capabilities.checkInOut) return 'skip' as const; await a.checkIn(c, String(p.externalId), String(p.roomNo)); }
  else if (e.topic === 'pms.check_out') { if (!a.capabilities.checkInOut) return 'skip' as const; await a.checkOut(c, String(p.externalId)); }
  else if (e.topic === 'pms.room_status') { if (!a.capabilities.roomStatus) return 'skip' as const; await a.setHousekeeping(c, String(p.roomNo), p.status); }
  else if (e.topic === 'pms.push_booking') { if (!a.capabilities.pushBooking) return 'skip' as const; const r = await a.pushBooking(c, p as never); if (p.bookingId) await tx.externalRef.upsert({ where: { connectionId_entityType_entityId: { connectionId: conn.id, entityType: 'booking', entityId: p.bookingId } }, create: { supplierId: conn.supplierId, connectionId: conn.id, entityType: 'booking', entityId: p.bookingId, externalId: r.externalId }, update: { externalId: r.externalId } }); }
  else return 'skip' as const;
  return 'done' as const;
}

/** IN events: a provider told us something (webhook). Currently the PMS reservation and room messages. */
async function runInbound(tx: Tx, e: { supplierId: string; connectionId: string | null; topic: string; payload: unknown }) {
  const p = (e.payload ?? {}) as Record<string, any>;
  if (!e.connectionId) return 'skip' as const;
  if (e.topic === 'pms.reservation') { await upsertReservation(tx, { id: e.connectionId, supplierId: e.supplierId }, p as PmsReservation); return 'done' as const; }
  if (e.topic === 'pms.room') { await tx.pmsRoomState.upsert({ where: { connectionId_roomNo: { connectionId: e.connectionId, roomNo: String(p.roomNo) } }, create: { supplierId: e.supplierId, connectionId: e.connectionId, roomNo: String(p.roomNo), foStatus: String(p.foStatus ?? 'VACANT'), hkStatus: String(p.hkStatus ?? 'CLEAN') }, update: { foStatus: String(p.foStatus ?? 'VACANT'), hkStatus: String(p.hkStatus ?? 'CLEAN'), syncedAt: new Date() } }); return 'done' as const; }
  return 'skip' as const;
}

/** One pass over due events. Each event runs in its own transaction, so one bad event never blocks the rest. */
export async function processEvents(limit = 25) {
  const due = await withDb(SYS, (tx) => tx.integrationEvent.findMany({ where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } }, orderBy: { createdAt: 'asc' }, take: limit }));
  let done = 0;
  for (const e of due) {
    try {
      const out = await withDb(SYS, (tx) => (e.direction === 'IN' ? runInbound(tx, e) : e.webhookId ? deliverWebhook(tx, e) : runCommand(tx, e)));
      await withDb(SYS, (tx) => tx.integrationEvent.update({ where: { id: e.id }, data: out === 'done' ? { status: 'DONE', doneAt: new Date(), attempts: { increment: 1 }, lastError: null } : { status: 'SKIPPED', attempts: { increment: 1 }, lastError: 'Nothing to do for this connection' } }));
      if (out === 'done') done++;
    } catch (err) {
      const msg = (err instanceof Error ? err.message : 'Failed').slice(0, 500);
      const retryable = (err as { retryable?: boolean })?.retryable !== false;
      const dead = !retryable || e.attempts + 1 >= MAX_EVENT_ATTEMPTS;
      await withDb(SYS, async (tx) => {
        await tx.integrationEvent.update({ where: { id: e.id }, data: { attempts: { increment: 1 }, lastError: msg, status: dead ? 'DEAD' : 'PENDING', nextAttemptAt: new Date(Date.now() + backoffSeconds(e.attempts) * 1000) } });
        if (e.connectionId) await tx.integrationConnection.updateMany({ where: { id: e.connectionId }, data: { lastError: msg, ...(dead ? { status: 'ERROR' as const } : {}) } });
      });
      logger.warn({ id: e.id, topic: e.topic, err: msg }, 'Integration event failed');
    }
  }
  return done;
}

export function startIntegrationWorker() {
  if (config.NODE_ENV === 'test' || !config.INTEGRATION_WORKER_SECONDS) return () => {};
  let busy = false;
  const t = setInterval(async () => { if (busy) return; busy = true; try { const n = await processEvents(); if (n) logger.info({ done: n }, 'Integration events delivered'); } catch (err) { logger.error({ err }, 'Integration worker failed'); } finally { busy = false; } }, config.INTEGRATION_WORKER_SECONDS * 1000);
  t.unref();
  return () => clearInterval(t);
}

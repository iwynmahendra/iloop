import { describe, expect, it, vi, afterEach } from 'vitest';
import { api, bearer, makeSupplier, superSession, type Session } from './helpers.js';
import { withDb } from '../src/db.js';
import { endpointSecret, inboundSecret, signatureHeader, verifySignature } from '../src/integrations/security.js';
import { queuePms } from '../src/integrations/events.js';
import { processEvents } from '../src/integrations/worker.js';
import { mockPms } from '../src/integrations/mock.js';

const SYS = { role: 'SUPER_ADMIN', supplierId: null } as const;
let A: Awaited<ReturnType<typeof makeSupplier>>, B: Awaited<ReturnType<typeof makeSupplier>>, sup: Session;
const post = (s: Session, p: string, b?: object) => api().post('/api/v1' + p).set(bearer(s.token)).send(b ?? {});
const get = (s: Session, p: string) => api().get('/api/v1' + p).set(bearer(s.token));
const drain = async () => { for (let i = 0; i < 4; i++) await processEvents(100); };
afterEach(() => vi.restoreAllMocks());

describe('integrations', () => {
  it('sets up two hotels', async () => { sup = await superSession(); A = await makeSupplier(sup, 'IA'); B = await makeSupplier(sup, 'IB'); });

  it('signature helpers: valid, tampered, expired', () => {
    const s = 'insec_x', body = '{"a":1}', h = signatureHeader(s, body);
    expect(verifySignature(s, h, body)).toBe(true);
    expect(verifySignature(s, h, '{"a":2}')).toBe(false);
    expect(verifySignature(s, signatureHeader(s, body, Math.floor(Date.now() / 1000) - 3600), body)).toBe(false);
    expect(verifySignature(s, undefined, body)).toBe(false);
  });

  it('only admins manage connections, and a secret cannot be put in config', async () => {
    expect((await get(A.staff, '/integrations')).status).toBe(403);
    const bad = await post(A.admin, '/integrations', { kind: 'PMS', provider: 'mock', name: 'PMS', config: { password: 'x' } });
    expect(bad.status).toBe(422);
    const unk = await post(A.admin, '/integrations', { kind: 'PMS', provider: 'mock', name: 'PMS', config: { nope: 1 } });
    expect(unk.status).toBe(422);
    const http = await post(A.admin, '/integrations', { kind: 'PMS', provider: 'mock', name: 'PMS', config: { baseUrl: 'http://insecure' } });
    expect(http.status).toBe(422);
    const badRef = await post(A.admin, '/integrations', { kind: 'PMS', provider: 'mock', name: 'PMS', secretRef: 'my password' });
    expect(badRef.status).toBe(422);
    const noProv = await post(A.admin, '/integrations', { kind: 'PMS', provider: 'oracle9', name: 'PMS' });
    expect(noProv.status).toBe(400);
  });

  let connId = '';
  it('creates, tests and syncs a PMS (mock), safe to repeat', async () => {
    const c = await post(A.admin, '/integrations', { kind: 'PMS', provider: 'mock', name: 'Sandbox PMS', config: { postCharges: true, writeBack: true } });
    expect(c.status).toBe(201); connId = c.body.data.id;
    expect(c.body.data.inboundSecret).toMatch(/^insec_/);
    expect((await post(A.admin, '/integrations', { kind: 'PMS', provider: 'mock', name: 'Dup' })).status).toBe(409);
    const t = await post(A.admin, `/integrations/${connId}/test`);
    expect(t.body.data.ok).toBe(true);
    expect((await get(A.admin, '/integrations')).body.data[0].status).toBe('CONNECTED');
    const s1 = await post(A.admin, `/integrations/${connId}/sync`);
    expect(s1.body.data).toEqual({ reservations: 4, rooms: 3 });
    await post(A.admin, `/integrations/${connId}/sync`);
    expect((await get(A.admin, '/pms/reservations')).body.data).toHaveLength(4);
    expect((await get(A.staff, '/pms/rooms')).body.data).toHaveLength(3);
    const inh = await get(A.staff, '/pms/reservations?status=IN_HOUSE');
    expect(inh.body.data.map((r: any) => r.roomNo).sort()).toEqual(['201', '203']);
  });

  it('opera-cloud and vhp are honest stubs', async () => {
    const o = await post(A.admin, '/integrations', { kind: 'PMS', provider: 'opera-cloud', name: 'Opera', secretRef: 'OPERA_CLIENT_SECRET' });
    const t = await post(A.admin, `/integrations/${o.body.data.id}/test`);
    expect(t.body.data.ok).toBe(false);
    expect(t.body.data.message).toMatch(/OPERA_CLIENT_SECRET/);
    expect((await post(A.admin, `/integrations/${o.body.data.id}/sync`)).status).toBe(400);
  });

  it('the other hotel sees nothing of it', async () => {
    expect((await get(B.admin, '/integrations')).body.data).toHaveLength(0);
    expect((await get(B.admin, '/pms/reservations')).body.data).toHaveLength(0);
    expect((await api().patch(`/api/v1/integrations/${connId}`).set(bearer(B.admin.token)).send({ enabled: false })).status).toBe(404);
    expect((await post(B.admin, `/integrations/${connId}/test`)).status).toBe(404);
  });

  it('inbound: signed, idempotent, replay-proof, updates the mirror', async () => {
    const body = { id: 'evt-1', topic: 'pms.reservation', data: { externalId: 'M-2000', guestName: 'Ana Silva', arrival: '2030-01-10', departure: '2030-01-12', adults: 2, children: 0, status: 'RESERVED', roomType: 'Deluxe' } };
    const raw = JSON.stringify(body), url = `/api/v1/integrations/inbound/${connId}`;
    const send = (sig: string | undefined, b = raw) => { const r = api().post(url).set('content-type', 'application/json'); if (sig) r.set('x-signature', sig); return r.send(b); };
    expect((await send(undefined)).status).toBe(401);
    expect((await send(signatureHeader('insec_wrong', raw))).status).toBe(401);
    expect((await send(signatureHeader(inboundSecret(connId), raw, Math.floor(Date.now() / 1000) - 4000))).status).toBe(401);
    const ok1 = await send(signatureHeader(inboundSecret(connId), raw));
    expect(ok1.status).toBe(202); expect(ok1.body.data.accepted).toBe(true);
    const ok2 = await send(signatureHeader(inboundSecret(connId), raw));
    expect(ok2.body.data.duplicate).toBe(true);
    // a different hotel's connection id with this hotel's signature is refused
    expect((await api().post(`/api/v1/integrations/inbound/${connId}`).set('content-type', 'application/json').set('x-signature', signatureHeader(inboundSecret(connId), raw)).send(raw.replace('evt-1', 'evt-x'))).status).toBe(401);
    await drain();
    const rows = (await get(A.admin, '/pms/reservations?q=Silva')).body.data;
    expect(rows).toHaveLength(1); expect(rows[0].roomType).toBe('Deluxe');
    // unknown topic and extra keys are refused
    const odd = JSON.stringify({ id: 'evt-2', topic: 'pms.drop_tables', data: {} });
    expect((await send(signatureHeader(inboundSecret(connId), odd), odd)).status).toBe(422);
  });

  it('api keys are shown once and stored hashed', async () => {
    const k = await post(A.admin, '/api-keys', { name: 'Website', scopes: ['availability:read'] });
    expect(k.status).toBe(201); expect(k.body.data.key).toMatch(/^bk_[0-9a-f]{8}\./);
    const list = (await get(A.admin, '/api-keys')).body.data;
    expect(JSON.stringify(list)).not.toContain(k.body.data.key); expect(JSON.stringify(list)).not.toContain('keyHash');
    expect((await post(A.admin, '/api-keys', { name: 'x', scopes: ['everything'] })).status).toBe(422);
    expect((await api().delete(`/api/v1/api-keys/${k.body.data.id}`).set(bearer(A.admin.token))).status).toBe(200);
    expect((await get(A.admin, '/api-keys')).body.data[0].revokedAt).not.toBeNull();
    expect((await get(B.admin, '/api-keys')).body.data).toHaveLength(0);
  });

  it('webhooks: https only, signed delivery, retry then dead, manual retry', async () => {
    expect((await post(A.admin, '/webhooks', { url: 'http://x.test/h', topics: ['*'] })).status).toBe(422);
    const w = await post(A.admin, '/webhooks', { url: 'https://hooks.example.test/in', topics: ['booking.created'], description: 'CRM' });
    expect(w.status).toBe(201); const secret = w.body.data.secret; expect(secret).toBe(endpointSecret(w.body.data.id));
    await post(A.admin, `/webhooks/${w.body.data.id}/test`);
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    await drain();
    expect(f).toHaveBeenCalledTimes(1);
    const [, init] = f.mock.calls[0]! as [string, RequestInit];
    expect(verifySignature(secret, (init.headers as Record<string, string>)['x-signature'], init.body as string)).toBe(true);
    // a failing endpoint
    await post(A.admin, `/webhooks/${w.body.data.id}/test`);
    f.mockResolvedValue(new Response('no', { status: 500 }));
    await drain();
    let ev = (await get(A.admin, '/integration-events?status=PENDING')).body.data;
    expect(ev).toHaveLength(1); expect(ev[0].attempts).toBe(1); expect(ev[0].lastError).toMatch(/500/);
    // push it to its limit
    await withDb(SYS, (t) => t.integrationEvent.update({ where: { id: ev[0].id }, data: { attempts: 5, nextAttemptAt: new Date() } }));
    await drain();
    ev = (await get(A.admin, '/integration-events?status=DEAD')).body.data;
    expect(ev).toHaveLength(1);
    f.mockResolvedValue(new Response('ok', { status: 200 }));
    expect((await post(A.admin, `/integration-events/${ev[0].id}/retry`)).status).toBe(200);
    await drain();
    expect((await get(A.admin, '/integration-events?status=DONE')).body.data.length).toBeGreaterThanOrEqual(2);
    expect((await post(A.admin, `/integration-events/${ev[0].id}/retry`)).status).toBe(409);
  });

  it('charge to room: queued once, posted once, even if repeated', async () => {
    const stay = (await get(A.admin, '/pms/reservations?status=IN_HOUSE')).body.data.find((r: any) => r.roomNo === '201');
    const payload = { bookingId: '11111111-1111-4111-8111-111111111111', externalReservationId: stay.externalId, code: 'CLUB', amount: 500000, currency: 'IDR', description: 'Table', idempotencyKey: 'charge:t1' };
    const q = () => withDb(SYS, (t) => queuePms(t, A.id, 'pms.post_charge', payload, 'charge:t1', 'postCharges'));
    expect(await q()).toBe(1); expect(await q()).toBe(0);
    await drain();
    expect(mockPms.calls.filter((c) => c === 'charge:charge:t1')).toHaveLength(1);
    // the other hotel has no PMS: nothing is queued
    expect(await withDb(SYS, (t) => queuePms(t, B.id, 'pms.post_charge', payload, 'charge:t1', 'postCharges'))).toBe(0);
  });

  it('a PMS outage retries, then recovers', async () => {
    mockPms.failNext = 1;
    await withDb(SYS, (t) => queuePms(t, A.id, 'pms.room_status', { roomNo: '202', status: 'CLEAN' }, 'hk:202:' + Date.now(), 'writeBack'));
    await processEvents(100);
    const pend = (await get(A.admin, '/integration-events?status=PENDING&topic=pms.room_status')).body.data;
    expect(pend).toHaveLength(1); expect(pend[0].lastError).toMatch(/unavailable/);
    await withDb(SYS, (t) => t.integrationEvent.update({ where: { id: pend[0].id }, data: { nextAttemptAt: new Date() } }));
    await processEvents(100);
    expect((await get(A.admin, '/integration-events?status=DONE&topic=pms.room_status')).body.data).toHaveLength(1);
    expect(mockPms.rooms.get('202')?.hkStatus).toBe('CLEAN');
  });

  it('disabling and removing a connection', async () => {
    expect((await api().patch(`/api/v1/integrations/${connId}`).set(bearer(A.admin.token)).send({ enabled: false })).body.data.status).toBe('DISABLED');
    expect((await post(A.admin, `/integrations/${connId}/sync`)).status).toBe(400);
    expect((await api().delete(`/api/v1/integrations/${connId}`).set(bearer(A.admin.token))).status).toBe(200);
    expect((await get(A.admin, '/pms/reservations')).body.data).toHaveLength(0);
  });
});

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, hotelBody, makeSupplier, superSession, uniq, type Session } from './helpers.js';

let sup: Session; let A: Awaited<ReturnType<typeof makeSupplier>>; let B: Awaited<ReturnType<typeof makeSupplier>>;
let hotelA: any;
beforeAll(async () => {
  sup = await superSession(); A = await makeSupplier(sup, 'isoA'); B = await makeSupplier(sup, 'isoB');
  const r = await api().post('/api/v1/hotel/hotels').set(bearer(A.admin.token)).send(hotelBody());
  expect(r.status).toBe(201); hotelA = r.body.data;
});

describe('a supplier can never read or change another supplier\'s data (API)', () => {
  it('does not list it', async () => {
    const r = await api().get('/api/v1/hotel/hotels').set(bearer(B.admin.token));
    expect(r.status).toBe(200); expect(r.body.data.map((h: any) => h.id)).not.toContain(hotelA.id);
    expect(r.body.data.every((h: any) => h.supplierId === B.id)).toBe(true);
  });
  it('returns 404 (not 403) for get, patch, delete, restore and status by id', async () => {
    const t = bearer(B.admin.token); const u = `/api/v1/hotel/hotels/${hotelA.id}`;
    expect((await api().get(u).set(t)).status).toBe(404);
    expect((await api().patch(u).set(t).send({ name: 'hacked' })).status).toBe(404);
    expect((await api().patch(`${u}/status`).set(t).send({ status: 'INACTIVE' })).status).toBe(404);
    expect((await api().delete(u).set(t)).status).toBe(404);
    expect((await api().post(`${u}/restore`).set(t)).status).toBe(404);
    const still = await api().get(u).set(bearer(A.admin.token));
    expect(still.body.data.name).toBe(hotelA.name);
  });
  it('rejects a supplierId sent by the client', async () => {
    const r = await api().post('/api/v1/hotel/hotels').set(bearer(B.admin.token)).send({ ...hotelBody(), supplierId: A.id });
    expect(r.status).toBe(422);
  });
  it('ignores X-Supplier-Id from non-super users', async () => {
    const r = await api().get('/api/v1/hotel/hotels').set(bearer(B.admin.token)).set('X-Supplier-Id', A.id);
    expect(r.body.data.map((h: any) => h.id)).not.toContain(hotelA.id);
  });
  it('cannot attach a child to another supplier\'s parent', async () => {
    const r = await api().post('/api/v1/hotel/room-types').set(bearer(B.admin.token)).send({ hotelId: hotelA.id, code: 'X', name: 'X', basePrice: 1, currencyCode: 'IDR' });
    expect(r.status).toBe(422); expect(JSON.stringify(r.body.errors)).toContain('hotelId');
  });
  it('cannot read A\'s data through bulk, export, audit log or dashboard', async () => {
    const t = bearer(B.admin.token);
    expect((await api().post('/api/v1/hotel/hotels/bulk').set(t).send({ action: 'delete', ids: [hotelA.id] })).body.data.affected).toBe(0);
    expect((await api().get('/api/v1/hotel/hotels/export').set(t)).text).not.toContain(hotelA.id);
    const audit = await api().get('/api/v1/audit-logs').set(t);
    expect(audit.body.data.every((a: any) => a.supplierId === B.id)).toBe(true);
    const users = await api().get('/api/v1/users').set(t);
    expect(users.body.data.every((u: any) => u.supplierId === B.id)).toBe(true);
    expect((await api().get('/api/v1/dashboard').set(t)).body.data.counts.hotel.hotels).toBe(0);
  });
  it('supplier admins cannot manage suppliers or create users in another supplier', async () => {
    expect((await api().get('/api/v1/suppliers').set(bearer(B.admin.token))).status).toBe(403);
    const r = await api().post('/api/v1/users').set(bearer(B.admin.token)).send({ email: uniq('x') + '@example.test', name: 'X', role: 'SUPPLIER_STAFF', supplierId: A.id });
    expect(r.status).toBe(201); expect(r.body.data.user.supplierId).toBe(B.id); // body value ignored
    expect((await api().post('/api/v1/users').set(bearer(B.admin.token)).send({ email: uniq('s') + '@example.test', name: 'S', role: 'SUPER_ADMIN' })).status).toBe(403);
  });
  it('lets the super admin see everything and switch supplier', async () => {
    const all = await api().get('/api/v1/hotel/hotels').set(bearer(sup.token)).query({ limit: 100 });
    expect(all.body.data.map((h: any) => h.id)).toContain(hotelA.id);
    const one = await api().get('/api/v1/hotel/hotels').set(bearer(sup.token)).set('X-Supplier-Id', B.id);
    expect(one.body.data.map((h: any) => h.id)).not.toContain(hotelA.id);
  });
});

describe('role permissions', () => {
  it('staff can create and edit but not delete or restore', async () => {
    const t = bearer(A.staff.token);
    const c = await api().post('/api/v1/hotel/hotels').set(t).send(hotelBody()); expect(c.status).toBe(201);
    expect((await api().patch(`/api/v1/hotel/hotels/${c.body.data.id}`).set(t).send({ name: 'Renamed' })).status).toBe(200);
    expect((await api().delete(`/api/v1/hotel/hotels/${c.body.data.id}`).set(t)).status).toBe(403);
    expect((await api().post('/api/v1/hotel/hotels/bulk').set(t).send({ action: 'delete', ids: [c.body.data.id] })).status).toBe(403);
    expect((await api().get('/api/v1/users').set(t)).status).toBe(403);
    expect((await api().get('/api/v1/audit-logs').set(t)).status).toBe(403);
    expect((await api().delete(`/api/v1/hotel/hotels/${c.body.data.id}`).set(bearer(A.admin.token))).status).toBe(200);
  });
  it('only the super admin writes global reference data', async () => {
    expect((await api().post('/api/v1/shared/countries').set(bearer(A.admin.token)).send({ code: 'ZZ', name: 'Zed' })).status).toBe(403);
  });
  it('supplier users cannot edit platform reference data (shared amenities)', async () => {
    const list = await api().get('/api/v1/shared/amenities').set(bearer(A.admin.token)).query({ limit: 1 });
    expect(list.body.data.length).toBe(1);
    expect((await api().patch(`/api/v1/shared/amenities/${list.body.data[0].id}`).set(bearer(A.admin.token)).send({ name: 'hacked' })).status).toBe(404);
  });
});

// The second layer: even if application code forgot a filter, Postgres row level security still isolates tenants.
describe('database row level security (as the runtime role)', () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  afterAll(() => pool.end());
  const as = async (role: string, supplierId: string | null, sql: string, params: unknown[] = []) => {
    const c = await pool.connect();
    try { await c.query('BEGIN'); await c.query("SELECT set_config('app.role', $1, true), set_config('app.supplier_id', $2, true)", [role, supplierId ?? '']); const r = await c.query(sql, params); await c.query('ROLLBACK'); return r; }
    catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  };
  it('the runtime role is not a superuser and cannot bypass RLS', async () => {
    const r = await pool.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });
  it('returns nothing without a tenant context (fails closed)', async () => {
    expect((await pool.query('SELECT count(*)::int AS n FROM hotels')).rows[0].n).toBe(0);
  });
  it('hides other suppliers\' rows and blocks writes to them', async () => {
    expect((await as('SUPPLIER_ADMIN', B.id, 'SELECT count(*)::int AS n FROM hotels WHERE id = $1', [hotelA.id])).rows[0].n).toBe(0);
    expect((await as('SUPPLIER_ADMIN', B.id, 'UPDATE hotels SET name = $2 WHERE id = $1', [hotelA.id, 'x'])).rowCount).toBe(0);
    expect((await as('SUPPLIER_ADMIN', B.id, 'DELETE FROM hotels WHERE id = $1', [hotelA.id])).rowCount).toBe(0);
    await expect(as('SUPPLIER_ADMIN', B.id, "INSERT INTO hotels (supplier_id, code, name, country_code, currency_code) VALUES ($1, 'RLS', 'x', 'ID', 'IDR')", [A.id])).rejects.toThrow(/row-level security/);
  });
  it('the owner of a row can see it, and staff have no delete policy', async () => {
    expect((await as('SUPPLIER_ADMIN', A.id, 'SELECT count(*)::int AS n FROM hotels WHERE id = $1', [hotelA.id])).rows[0].n).toBe(1);
    expect((await as('SUPPLIER_STAFF', A.id, 'DELETE FROM hotels WHERE id = $1', [hotelA.id])).rowCount).toBe(0);
  });
  it('audit logs cannot be updated or deleted', async () => {
    expect((await as('SUPER_ADMIN', null, "UPDATE audit_logs SET entity_type = 'x'")).rowCount).toBe(0);
    expect((await as('SUPER_ADMIN', null, 'DELETE FROM audit_logs')).rowCount).toBe(0);
  });
});

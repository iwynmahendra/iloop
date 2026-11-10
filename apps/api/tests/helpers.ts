import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();
export const api = () => request(app);
export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe!2026';
export const SUPER_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@example.com';
export const PW = 'TestPass123!x';
export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
export const uniq = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface Session { token: string; cookie: string; csrf: string; user: any }
export async function login(email: string, password: string): Promise<Session> {
  const r = await api().post('/api/v1/auth/login').send({ email, password });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${r.body.message}`);
  const set: string[] = r.headers['set-cookie'] as unknown as string[];
  const val = (n: string) => set.find((c) => c.startsWith(n + '='))!.split(';')[0]!.slice(n.length + 1);
  return { token: r.body.data.accessToken, cookie: `refresh_token=${val('refresh_token')}; csrf_token=${val('csrf_token')}`, csrf: val('csrf_token'), user: r.body.data.user };
}
export const superSession = () => login(SUPER_EMAIL, SEED_PASSWORD);

/** A fresh supplier with an admin (and optionally a staff user), created through the API like a real super admin would. */
export async function makeSupplier(sup: Session, label = 'T') {
  const name = uniq(label);
  const s = await api().post('/api/v1/suppliers').set(bearer(sup.token)).send({ name, email: `${name}@example.test` });
  if (s.status !== 201) throw new Error('supplier ' + s.status + JSON.stringify(s.body));
  const id: string = s.body.data.id;
  const adminEmail = `admin-${name}@example.test`.toLowerCase();
  const a = await api().post(`/api/v1/suppliers/${id}/admin`).set(bearer(sup.token)).send({ email: adminEmail, name: 'Admin ' + name, password: PW });
  if (a.status !== 201) throw new Error('admin ' + a.status + JSON.stringify(a.body));
  const admin = await login(adminEmail, PW);
  const staffEmail = `staff-${name}@example.test`.toLowerCase();
  const st = await api().post('/api/v1/users').set(bearer(admin.token)).send({ email: staffEmail, name: 'Staff', role: 'SUPPLIER_STAFF', password: PW });
  if (st.status !== 201) throw new Error('staff ' + st.status + JSON.stringify(st.body));
  const staff = await login(staffEmail, PW);
  return { id, name, code: s.body.data.code as string, admin, staff, adminEmail, staffEmail };
}
export const hotelBody = (code = uniq('H')) => ({ code, name: 'Hotel ' + code, countryCode: 'ID', currencyCode: 'IDR' });

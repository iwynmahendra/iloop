import crypto from 'node:crypto';
import { config } from '../config.js';

const master = () => config.WEBHOOK_MASTER_KEY ?? config.JWT_ACCESS_SECRET;
const hmac = (key: string, data: string) => crypto.createHmac('sha256', key).update(data).digest('hex');
/** Secrets are derived, never stored: the same id always gives the same secret, and a database leak gives none. */
export const endpointSecret = (id: string) => 'whsec_' + hmac(master(), 'wh:' + id).slice(0, 40);
export const inboundSecret = (connectionId: string) => 'insec_' + hmac(master(), 'in:' + connectionId).slice(0, 40);
export const signBody = (secret: string, t: number, body: string) => hmac(secret, `${t}.${body}`);
export const signatureHeader = (secret: string, body: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${signBody(secret, t, body)}`;

/** Checks `t=<unix>,v1=<hex>`. Old timestamps are refused, so a captured request cannot be replayed later. */
export function verifySignature(secret: string, header: string | undefined, body: string, toleranceSeconds = 300, now = Date.now()) {
  const m = /^t=(\d{9,12}),v1=([0-9a-f]{64})$/.exec(header ?? '');
  if (!m) return false;
  const t = Number(m[1]);
  if (Math.abs(now / 1000 - t) > toleranceSeconds) return false;
  const want = Buffer.from(signBody(secret, t, body)), got = Buffer.from(m[2]!);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export const API_SCOPES = ['bookings:read', 'bookings:write', 'availability:read', 'rates:write', 'pms:read'] as const;
export function newApiKey() {
  const prefix = 'bk_' + crypto.randomBytes(4).toString('hex');
  const key = `${prefix}.${crypto.randomBytes(24).toString('base64url')}`;
  return { prefix, key, hash: crypto.createHash('sha256').update(key).digest('hex') };
}
export const hashKey = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

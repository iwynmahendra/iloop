import 'dotenv/config';
import { z } from 'zod';

const bool = (d: 'true' | 'false') => z.enum(['true', 'false']).default(d).transform((v) => v === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32).optional(), // refresh tokens are opaque and stored hashed; kept for compatibility
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(15 * 60),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: bool('false'),
  MAX_FAILED_LOGINS: z.coerce.number().default(5),
  LOCK_MINUTES: z.coerce.number().default(15),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  PUBLIC_UPLOAD_URL: z.string().default('/uploads'),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().default(5),
  APP_URL: z.string().default('http://localhost:5173'),
  BOOKING_HOLD_MINUTES: z.coerce.number().int().min(1).default(60),
  /** How long a guest concierge request waits for staff before it expires. */
  CONCIERGE_HOLD_MINUTES: z.coerce.number().int().min(1).default(480),
  /** Booking emails: who gets one when a booking is made, and how often the sender runs (0 = off). */
  MAIL_FROM: z.string().default('Bookings <no-reply@example.com>'),
  NOTIFY_GUEST_EMAIL: bool('true'),
  NOTIFY_SUPPLIER_EMAIL: bool('true'),
  EMAIL_SEND_SECONDS: z.coerce.number().int().min(0).default(10),
  /** Integrations: webhook secrets are derived from this key (falls back to the JWT secret), and how often the worker runs (0 = off). */
  WEBHOOK_MASTER_KEY: z.string().min(32).optional(),
  INTEGRATION_WORKER_SECONDS: z.coerce.number().int().min(0).default(15),
  HOLD_SWEEP_SECONDS: z.coerce.number().int().min(0).default(60), // 0 = sweeper off
  BOOKING_TZ_OFFSET_MINUTES: z.coerce.number().int().default(480), // Bali (UTC+8): where "today" starts for boards and cut-offs
  TRANSPORT_CLASH_MINUTES: z.coerce.number().int().default(180),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', z.prettifyError(parsed.error));
  process.exit(1);
}
export const config = parsed.data;

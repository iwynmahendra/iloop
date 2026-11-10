import type { Booking, Supplier } from '@prisma/client';
import { config } from '../config.js';
import { withDb, type Tx } from '../db.js';
import { logger } from '../logger.js';
import { mailer } from '../mail.js';
import type { Actor } from './util.js';
import { addEvent } from './util.js';

const MAX_ATTEMPTS = 5;
/** Anything that goes into a subject must be one line, or a guest name could inject headers. */
const oneLine = (s: string | null | undefined) => (s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '');
const money = (b: Booking) => `${b.currencyCode} ${Number(b.totalAmount).toLocaleString('en-US')}`;

export function guestEmail(b: Booking, s: Supplier, what: string) {
  const pending = b.status === 'PENDING';
  const lines = [
    `Hello ${oneLine(b.guestName)},`, '',
    pending ? `We have received your booking request with ${s.name}. We will confirm it soon.` : `Your booking with ${s.name} is confirmed.`, '',
    `Booking number: ${b.bookingNo}`, `What: ${what}`, `When: ${fmtDate(b.startAt)}${b.endAt ? ` to ${fmtDate(b.endAt)}` : ''}`, `Total: ${money(b)}`,
    ...(b.roomNumber ? [`Charged to room: ${b.roomNumber}`] : []),
    ...(pending && b.holdExpiresAt ? ['', `We hold this request until ${fmtDate(b.holdExpiresAt)}.`] : []),
    '', `Questions? Reply to this email or contact ${s.name}${s.phone ? ` on ${s.phone}` : ''}.`,
  ];
  return { subject: `${pending ? 'Booking request received' : 'Booking confirmed'}: ${b.bookingNo}`, body: lines.join('\n') };
}

export function supplierEmail(b: Booking, s: Supplier, what: string) {
  const lines = [
    `New ${b.product.toLowerCase()} booking for ${s.name}.`, '',
    `Booking number: ${b.bookingNo}`, `Status: ${b.status}`, `Source: ${b.source.toLowerCase().replace('_', ' ')}`, `What: ${what}`, `When: ${fmtDate(b.startAt)}${b.endAt ? ` to ${fmtDate(b.endAt)}` : ''}`, `Total: ${money(b)}`, '',
    `Guest: ${oneLine(b.guestName)}`, ...(b.guestEmail ? [`Email: ${b.guestEmail}`] : []), ...(b.guestPhone ? [`Phone: ${b.guestPhone}`] : []), ...(b.roomNumber ? [`Room: ${b.roomNumber}`] : []),
    ...(b.specialRequests ? ['', `Requests: ${b.specialRequests.slice(0, 500)}`] : []),
    '', `Open it: ${config.APP_URL}/bookings/${b.id}`,
  ];
  return { subject: `New booking ${b.bookingNo} (${b.status.toLowerCase()})`, body: lines.join('\n') };
}

/** Writes one outbox row for the guest and one for the supplier, in the booking's own transaction. Never throws for a missing address. */
export async function queueBookingEmails(tx: Tx, actor: Actor, b: Booking, s: Supplier, what: string) {
  const rows: { recipientKind: 'GUEST' | 'SUPPLIER'; toEmail: string | null; status: 'QUEUED' | 'SKIPPED'; lastError: string | null; subject: string; bodyText: string; template: string }[] = [];
  if (config.NOTIFY_GUEST_EMAIL) {
    const m = guestEmail(b, s, what);
    rows.push({ recipientKind: 'GUEST', toEmail: b.guestEmail, status: b.guestEmail ? 'QUEUED' : 'SKIPPED', lastError: b.guestEmail ? null : 'The guest gave no email address', subject: m.subject, bodyText: m.body, template: 'booking_created_guest' });
  }
  if (config.NOTIFY_SUPPLIER_EMAIL) {
    const m = supplierEmail(b, s, what);
    rows.push({ recipientKind: 'SUPPLIER', toEmail: s.email, status: 'QUEUED', lastError: null, subject: m.subject, bodyText: m.body, template: 'booking_created_supplier' });
  }
  if (!rows.length) return;
  for (const r of rows) await tx.emailOutbox.create({ data: { supplierId: b.supplierId, bookingId: b.id, ...r } });
  const q = rows.filter((r) => r.status === 'QUEUED').map((r) => r.recipientKind.toLowerCase());
  await addEvent(tx, actor, b, 'NOTIFICATION', { message: q.length ? `Booking email queued for the ${q.join(' and the ')}` : 'No booking email could be queued', data: { guest: rows.find((r) => r.recipientKind === 'GUEST')?.status ?? 'OFF', supplier: rows.find((r) => r.recipientKind === 'SUPPLIER')?.status ?? 'OFF' } });
}

/** Delivers queued emails. Runs as SUPER_ADMIN so it sees every supplier. A failure is kept and retried up to 5 times. */
export async function deliverEmails(limit = 25) {
  let sent = 0;
  const rows = await withDb({ role: 'SUPER_ADMIN', supplierId: null }, (t) => t.emailOutbox.findMany({ where: { status: 'QUEUED', attempts: { lt: MAX_ATTEMPTS } }, orderBy: { createdAt: 'asc' }, take: limit }));
  for (const r of rows) {
    if (!r.toEmail) continue;
    try {
      await mailer.send(r.toEmail, r.subject, r.bodyText);
      await withDb({ role: 'SUPER_ADMIN', supplierId: null }, (t) => t.emailOutbox.updateMany({ where: { id: r.id, status: 'QUEUED' }, data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null } }));
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 500) : 'Send failed';
      await withDb({ role: 'SUPER_ADMIN', supplierId: null }, (t) => t.emailOutbox.updateMany({ where: { id: r.id, status: 'QUEUED' }, data: { attempts: { increment: 1 }, lastError: msg, status: r.attempts + 1 >= MAX_ATTEMPTS ? 'FAILED' : 'QUEUED' } }));
      logger.warn({ err, id: r.id }, 'Booking email failed');
    }
  }
  return sent;
}

export function startMailer() {
  if (config.NODE_ENV === 'test' || !config.EMAIL_SEND_SECONDS) return () => {};
  let busy = false;
  const t = setInterval(async () => { if (busy) return; busy = true; try { const n = await deliverEmails(); if (n) logger.info({ sent: n }, 'Booking emails sent'); } catch (err) { logger.error({ err }, 'Email sender failed'); } finally { busy = false; } }, config.EMAIL_SEND_SECONDS * 1000);
  t.unref();
  return () => clearInterval(t);
}

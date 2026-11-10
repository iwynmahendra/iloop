import { emit } from '../integrations/events.js';
import { Prisma, type Booking, type BookingStatus } from '@prisma/client';
import { config } from '../config.js';
import type { Tx } from '../db.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../http.js';
import type { Scope } from '../types.js';
import { OPEN_STATUSES, SYSTEM_ACTOR, addEvent, audit, localInstant, num, round, todayStr, ymd, type Actor } from './util.js';

const fail = (m: string, errors?: unknown) => new AppError(422, m, errors);

export async function getBookingFor(tx: Tx, scope: Scope, id: string, opts: { deleted?: boolean } = {}) {
  const b = await tx.booking.findFirst({ where: { id, ...(scope.supplierId ? { supplierId: scope.supplierId } : {}), deletedAt: opts.deleted ? { not: null } : null } });
  if (!b) throw notFound('Booking not found');
  return b;
}

/** Gives held stock back when a booking is cancelled or its hold expires. */
export async function releaseInventory(tx: Tx, b: Pick<Booking, 'id' | 'supplierId' | 'product'>) {
  if (b.product === 'HOTEL') {
    for (const i of await tx.hotelBookingItem.findMany({ where: { bookingId: b.id } }))
      await tx.$executeRaw`UPDATE room_inventory SET available_units = LEAST(total_units, available_units + ${i.rooms}), updated_at = CURRENT_TIMESTAMP
        WHERE supplier_id = ${b.supplierId}::uuid AND room_type_id = ${i.roomTypeId}::uuid AND date >= ${ymd(i.checkIn)}::date AND date < ${ymd(i.checkOut)}::date`;
  } else if (b.product === 'TRIP') {
    for (const i of await tx.tripBookingItem.findMany({ where: { bookingId: b.id } }))
      await tx.$executeRaw`UPDATE trip_schedules SET remaining_quota = LEAST(quota, remaining_quota + ${i.adults + i.children}), updated_at = CURRENT_TIMESTAMP WHERE id = ${i.scheduleId}::uuid AND supplier_id = ${b.supplierId}::uuid`;
  }
  // Club stock is counted from live bookings and transport has no stock, so there is nothing to give back.
}

export interface CancelPreview { hoursUntilStart: number; refundPercent: number; paid: number; refundable: number; policy: { id: string; name: string } | null; note: string }
export async function cancelPreview(tx: Tx, b: Booking): Promise<CancelPreview> {
  const hours = (b.startAt.getTime() - Date.now()) / 36e5;
  const paid = num(b.paidAmount);
  let policy: { id: string; name: string } | null = null, pct = 0, note = '';
  if (b.cancellationPolicyId) {
    const p = await tx.cancellationPolicy.findFirst({ where: { id: b.cancellationPolicyId }, include: { rules: { where: { deletedAt: null, status: 'ACTIVE' }, orderBy: { hoursBeforeStart: 'desc' } } } });
    if (p) {
      policy = { id: p.id, name: p.name };
      const rule = p.rules.find((r) => hours >= r.hoursBeforeStart);
      pct = rule ? num(rule.refundPercent) : 0;
      note = `${p.name}: ${pct}% refund when cancelled ${hours >= 0 ? Math.floor(hours) + ' hours' : 'after the start'} before start`;
    }
  } else if (b.status === 'PENDING') { pct = 100; note = 'Not confirmed yet: full refund of anything paid'; }
  else note = 'No cancellation policy is set. Any refund is up to you.';
  return { hoursUntilStart: round(hours, 1), refundPercent: pct, paid, refundable: round(paid * pct / 100, 2), policy, note };
}

async function move(tx: Tx, actor: Actor, b: Booking, to: BookingStatus, data: Prisma.BookingUncheckedUpdateInput, message: string) {
  const updated = await tx.booking.update({ where: { id: b.id }, data: { ...data, status: to, updatedBy: actor.userId } });
  await addEvent(tx, actor, b, 'STATUS_CHANGED', { from: b.status, to, message });
  await emit(tx, b.supplierId, 'booking.status_changed', { bookingId: b.id, bookingNo: b.bookingNo, from: b.status, to }, `booking.status:${b.id}:${to}:${Date.now()}`);
  await audit(tx, actor, 'UPDATE', 'Booking', b.id, b.supplierId, { status: b.status }, { status: to, note: message });
  return updated;
}

export async function changeStatus(tx: Tx, scope: Scope, actor: Actor, id: string, to: 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW', note?: string | null) {
  const b = await getBookingFor(tx, scope, id);
  const msg = note || ({ CONFIRMED: 'Confirmed', COMPLETED: 'Completed', NO_SHOW: 'Guest did not show up' } as const)[to];
  if (to === 'CONFIRMED') {
    if (b.status !== 'PENDING') throw conflict(`A ${b.status.toLowerCase()} booking cannot be confirmed`);
    if (b.holdExpiresAt && b.holdExpiresAt.getTime() < Date.now() && num(b.paidAmount) <= 0) throw conflict('The hold on this booking has expired. Create a new booking.');
    return move(tx, actor, b, 'CONFIRMED', { confirmedAt: new Date(), holdExpiresAt: null }, msg);
  }
  if (b.status !== 'CONFIRMED') throw conflict(`Only a confirmed booking can be marked ${to === 'COMPLETED' ? 'completed' : 'no-show'} (this one is ${b.status.toLowerCase()})`);
  if (b.startAt.getTime() > Date.now()) throw conflict('The service has not started yet');
  return move(tx, actor, b, to, to === 'COMPLETED' ? { completedAt: new Date() } : {}, msg);
}

/** Cancel with policy refund. Staff may cancel a pending booking only and never issue refunds. */
export async function cancelBooking(tx: Tx, scope: Scope, actor: Actor, id: string, input: { reason: string; refundAmount?: number }) {
  const b = await getBookingFor(tx, scope, id);
  if (!OPEN_STATUSES.includes(b.status)) throw conflict(`A ${b.status.toLowerCase()} booking cannot be cancelled`);
  const staff = scope.role === 'SUPPLIER_STAFF';
  if (staff && b.status === 'CONFIRMED') throw forbidden('Only an admin can cancel a confirmed booking');
  if (staff && num(b.paidAmount) > 0) throw forbidden('This booking has payments. Ask an admin to cancel it and handle the refund.');
  if (staff && input.refundAmount != null) throw forbidden('Only an admin can choose a refund amount');
  const prev = await cancelPreview(tx, b);
  const refund = staff ? 0 : round(Math.min(input.refundAmount ?? prev.refundable, prev.paid), 2);
  if (input.refundAmount != null && input.refundAmount > prev.paid) throw fail(`At most ${prev.paid} has been paid`, [{ field: 'refundAmount', message: 'More than was paid' }]);
  const updated = await move(tx, actor, b, 'CANCELLED', { cancelledAt: new Date(), cancelReason: input.reason, cancelledBy: actor.userId, holdExpiresAt: null }, `Cancelled: ${input.reason}`);
  await releaseInventory(tx, b);
  let remaining = refund;
  if (remaining > 0) {
    const pays = await tx.payment.findMany({ where: { bookingId: b.id, kind: 'PAYMENT', txStatus: 'SUCCEEDED' }, orderBy: { paidAt: 'desc' } });
    for (const p of pays) {
      if (remaining <= 0) break;
      const done = await tx.payment.aggregate({ where: { refundOfId: p.id, txStatus: 'SUCCEEDED' }, _sum: { amount: true } });
      const room = round(num(p.amount) - num(done._sum.amount), 2);
      const part = round(Math.min(room, remaining), 2);
      if (part <= 0) continue;
      await tx.payment.create({ data: { supplierId: b.supplierId, bookingId: b.id, kind: 'REFUND', method: p.method, amount: part, currencyCode: p.currencyCode, refundOfId: p.id, reference: `RF-${b.bookingNo}`, notes: 'Cancellation refund', recordedBy: actor.userId, createdBy: actor.userId } });
      await addEvent(tx, actor, b, 'REFUND', { message: `Refund issued: ${p.currencyCode} ${part}`, data: { amount: part, paymentId: p.id } });
      remaining = round(remaining - part, 2);
    }
  }
  return { booking: updated, refunded: round(refund - remaining, 2), preview: prev };
}

/** Pending bookings whose hold ran out are expired and their stock is released. Runs from the sweeper and from POST /bookings/expire-holds. */
export async function expireHolds(tx: Tx, actor: Actor = SYSTEM_ACTOR, supplierId?: string) {
  const due = await tx.booking.findMany({ where: { status: 'PENDING', deletedAt: null, holdExpiresAt: { lt: new Date() }, paidAmount: 0, ...(supplierId ? { supplierId } : {}) }, take: 200, orderBy: { holdExpiresAt: 'asc' } });
  for (const b of due) {
    await move(tx, actor, b, 'EXPIRED', { holdExpiresAt: null }, 'Hold expired without payment');
    await releaseInventory(tx, b);
  }
  return due.length;
}

/* ------------------------------------------------------------------ payments */
export async function recordPayment(tx: Tx, scope: Scope, actor: Actor, id: string, input: { amount: number; method: any; reference?: string | null; paidAt?: string; notes?: string | null; status: 'SUCCEEDED' | 'PENDING' }) {
  const b = await getBookingFor(tx, scope, id);
  if (b.status === 'CANCELLED' || b.status === 'EXPIRED') throw conflict(`A ${b.status.toLowerCase()} booking cannot take payments`);
  const outstanding = round(num(b.totalAmount) - num(b.paidAmount), 2);
  if (input.status === 'SUCCEEDED' && input.amount > outstanding + 0.001) throw fail(`The outstanding balance is ${outstanding}`, [{ field: 'amount', message: `At most ${outstanding}` }]);
  const p = await tx.payment.create({ data: { supplierId: b.supplierId, bookingId: b.id, kind: 'PAYMENT', method: input.method, txStatus: input.status, amount: input.amount, currencyCode: b.currencyCode, reference: input.reference, paidAt: input.paidAt ? new Date(input.paidAt) : new Date(), notes: input.notes, recordedBy: actor.userId, createdBy: actor.userId } });
  await addEvent(tx, actor, b, 'PAYMENT', { message: `Payment ${input.status === 'SUCCEEDED' ? 'received' : 'pending'}: ${b.currencyCode} ${input.amount} (${input.method})`, data: { paymentId: p.id, amount: input.amount } });
  await audit(tx, actor, 'CREATE', 'Payment', p.id, b.supplierId, undefined, { bookingNo: b.bookingNo, amount: input.amount, method: input.method });
  return p;
}

export async function issueRefund(tx: Tx, scope: Scope, actor: Actor, id: string, input: { paymentId: string; amount: number; method?: any; reference?: string | null; notes?: string | null }) {
  const b = await getBookingFor(tx, scope, id);
  const orig = await tx.payment.findFirst({ where: { id: input.paymentId, bookingId: b.id, kind: 'PAYMENT', txStatus: 'SUCCEEDED' } });
  if (!orig) throw fail('Choose a successful payment of this booking', [{ field: 'paymentId', message: 'Not a successful payment of this booking' }]);
  const done = await tx.payment.aggregate({ where: { refundOfId: orig.id, txStatus: 'SUCCEEDED' }, _sum: { amount: true } });
  const room = round(num(orig.amount) - num(done._sum.amount), 2);
  if (input.amount > room + 0.001) throw fail(`At most ${room} can still be refunded on this payment`, [{ field: 'amount', message: `At most ${room}` }]);
  const r = await tx.payment.create({ data: { supplierId: b.supplierId, bookingId: b.id, kind: 'REFUND', method: input.method ?? orig.method, amount: input.amount, currencyCode: b.currencyCode, refundOfId: orig.id, reference: input.reference, notes: input.notes, recordedBy: actor.userId, createdBy: actor.userId } });
  await addEvent(tx, actor, b, 'REFUND', { message: `Refund issued: ${b.currencyCode} ${input.amount}`, data: { paymentId: orig.id, refundId: r.id, amount: input.amount } });
  await audit(tx, actor, 'CREATE', 'Payment', r.id, b.supplierId, undefined, { bookingNo: b.bookingNo, refund: input.amount, of: orig.id });
  return r;
}

export async function voidPayment(tx: Tx, scope: Scope, actor: Actor, paymentId: string) {
  const p = await tx.payment.findFirst({ where: { id: paymentId, ...(scope.supplierId ? { supplierId: scope.supplierId } : {}) } });
  if (!p) throw notFound('Payment not found');
  if (p.txStatus === 'VOIDED') throw conflict('This payment is already voided');
  if (p.kind === 'PAYMENT') { const refunds = await tx.payment.count({ where: { refundOfId: p.id, txStatus: 'SUCCEEDED' } }); if (refunds) throw conflict('Void the refunds on this payment first'); }
  const upd = await tx.payment.updateMany({ where: { id: p.id }, data: { txStatus: 'VOIDED', updatedBy: actor.userId } });
  if (upd.count !== 1) throw forbidden();
  const b = await tx.booking.findUniqueOrThrow({ where: { id: p.bookingId } });
  await addEvent(tx, actor, b, p.kind === 'REFUND' ? 'REFUND' : 'PAYMENT', { message: `${p.kind === 'REFUND' ? 'Refund' : 'Payment'} of ${p.currencyCode} ${p.amount} voided`, data: { paymentId: p.id } });
  await audit(tx, actor, 'UPDATE', 'Payment', p.id, p.supplierId, { txStatus: p.txStatus }, { txStatus: 'VOIDED' });
}

/* ------------------------------------------------------------------ operations: check-in, dispatch */
async function operable(tx: Tx, scope: Scope, id: string, product: Booking['product']) {
  const b = await getBookingFor(tx, scope, id);
  if (b.product !== product) throw badRequest(`This action is for ${product.toLowerCase()} bookings`);
  if (b.status !== 'CONFIRMED') throw conflict(`Only a confirmed booking can be handled (this one is ${b.status.toLowerCase()})`);
  return b;
}
const pick = <T extends { id: string }>(items: T[], itemId?: string) => { const i = itemId ? items.find((x) => x.id === itemId) : items[0]; if (!i) throw notFound('Booking item not found'); return i; };

export async function hotelCheckIn(tx: Tx, scope: Scope, actor: Actor, id: string, input: { roomNumber: string; itemId?: string }) {
  const b = await operable(tx, scope, id, 'HOTEL');
  const i = pick(await tx.hotelBookingItem.findMany({ where: { bookingId: b.id }, orderBy: { createdAt: 'asc' } }), input.itemId);
  if (i.checkedInAt) throw conflict('Already checked in');
  if (ymd(i.checkIn) > todayStr()) throw conflict(`Check-in is on ${ymd(i.checkIn)}`);
  await tx.hotelBookingItem.update({ where: { id: i.id }, data: { checkedInAt: new Date(), roomNumber: input.roomNumber, updatedBy: actor.userId } });
  await addEvent(tx, actor, b, 'CHECK_IN', { message: `Checked in to room ${input.roomNumber}` });
  await audit(tx, actor, 'UPDATE', 'Booking', b.id, b.supplierId, { checkedIn: false }, { checkedIn: true, room: input.roomNumber });
}
export async function hotelCheckOut(tx: Tx, scope: Scope, actor: Actor, id: string, input: { itemId?: string }) {
  const b = await operable(tx, scope, id, 'HOTEL');
  const items = await tx.hotelBookingItem.findMany({ where: { bookingId: b.id }, orderBy: { createdAt: 'asc' } });
  const i = pick(items, input.itemId);
  if (!i.checkedInAt) throw conflict('Check the guest in first');
  if (i.checkedOutAt) throw conflict('Already checked out');
  await tx.hotelBookingItem.update({ where: { id: i.id }, data: { checkedOutAt: new Date(), updatedBy: actor.userId } });
  await addEvent(tx, actor, b, 'CHECK_OUT', { message: `Checked out of room ${i.roomNumber ?? ''}`.trim() });
  if (items.every((x) => x.id === i.id || x.checkedOutAt)) await move(tx, actor, b, 'COMPLETED', { completedAt: new Date() }, 'Completed at check-out');
}
export async function tripCheckIn(tx: Tx, scope: Scope, actor: Actor, id: string, input: { participantsShown: number; itemId?: string }) {
  const b = await operable(tx, scope, id, 'TRIP');
  const i = pick(await tx.tripBookingItem.findMany({ where: { bookingId: b.id } }), input.itemId);
  if (input.participantsShown > i.adults + i.children) throw fail(`The booking has ${i.adults + i.children} guests`, [{ field: 'participantsShown', message: 'More than booked' }]);
  await tx.tripBookingItem.update({ where: { id: i.id }, data: { checkedInAt: new Date(), participantsShown: input.participantsShown, updatedBy: actor.userId } });
  await addEvent(tx, actor, b, 'CHECK_IN', { message: `${input.participantsShown} of ${i.adults + i.children} guests showed up` });
}
export async function clubCheckIn(tx: Tx, scope: Scope, actor: Actor, id: string, input: { count: number; tableLabel?: string | null; itemId?: string }) {
  const b = await operable(tx, scope, id, 'CLUB');
  const i = pick(await tx.clubBookingItem.findMany({ where: { bookingId: b.id } }), input.itemId);
  if (ymd(i.visitDate) !== todayStr()) throw conflict(`This booking is for ${ymd(i.visitDate)}`);
  if (i.checkedInCount + input.count > i.guests) throw fail(`${i.guests - i.checkedInCount} guest(s) left to check in`, [{ field: 'count', message: 'More than booked' }]);
  await tx.clubBookingItem.update({ where: { id: i.id }, data: { checkedInAt: i.checkedInAt ?? new Date(), checkedInCount: { increment: input.count }, ...(input.tableLabel ? { tableLabel: input.tableLabel } : {}), updatedBy: actor.userId } });
  await addEvent(tx, actor, b, 'CHECK_IN', { message: `${input.count} guest(s) through the door (${i.checkedInCount + input.count} of ${i.guests})` });
}

export async function assignTransport(tx: Tx, scope: Scope, actor: Actor, id: string, input: { driverId: string | null; vehicleId?: string | null; driverNotes?: string | null; itemId?: string }) {
  const b = await operable(tx, scope, id, 'TRANSPORT');
  const items = await tx.transportBookingItem.findMany({ where: { bookingId: b.id }, orderBy: { pickupAt: 'asc' } });
  const i = pick(items, input.itemId);
  if (['PICKED_UP', 'DROPPED_OFF'].includes(i.assignmentStatus)) throw conflict('The trip is already under way');
  if (input.driverId === null) {
    await tx.transportBookingItem.update({ where: { id: i.id }, data: { driverId: null, vehicleId: null, assignmentStatus: 'UNASSIGNED', assignedAt: null, updatedBy: actor.userId } });
    await addEvent(tx, actor, b, 'ASSIGNMENT', { message: 'Driver unassigned' }); return;
  }
  const sid = b.supplierId;
  const driver = await tx.driver.findFirst({ where: { id: input.driverId, supplierId: sid, status: 'ACTIVE', deletedAt: null } });
  if (!driver) throw fail('Driver not found or not active', [{ field: 'driverId', message: 'Not found or not active' }]);
  let vehicleId = input.vehicleId ?? null;
  if (vehicleId) {
    const v = await tx.vehicle.findFirst({ where: { id: vehicleId, supplierId: sid, status: 'ACTIVE', deletedAt: null } });
    if (!v) throw fail('Vehicle not found or not active', [{ field: 'vehicleId', message: 'Not found or not active' }]);
    if (v.vehicleTypeId !== i.vehicleTypeId) throw fail('This vehicle is not of the booked vehicle type', [{ field: 'vehicleId', message: 'Wrong vehicle type' }]);
    if (v.insuranceExpiry && v.insuranceExpiry.getTime() < i.pickupAt.getTime()) throw fail('Insurance on this vehicle expires before the pick-up', [{ field: 'vehicleId', message: 'Insurance expired' }]);
  }
  if (driver.licenseExpiry && driver.licenseExpiry.getTime() < i.pickupAt.getTime()) throw fail('This driver\'s licence expires before the pick-up', [{ field: 'driverId', message: 'Licence expired' }]);
  const w = config.TRANSPORT_CLASH_MINUTES * 6e4;
  const clash = await tx.transportBookingItem.findFirst({ where: { supplierId: sid, id: { not: i.id }, pickupAt: { gt: new Date(i.pickupAt.getTime() - w), lt: new Date(i.pickupAt.getTime() + w) },
    OR: [{ driverId: driver.id }, ...(vehicleId ? [{ vehicleId }] : [])], booking: { status: { in: OPEN_STATUSES }, deletedAt: null } }, include: { booking: { select: { bookingNo: true } } } });
  if (clash) throw conflict(`Clash with ${clash.booking.bookingNo} at ${clash.pickupAt.toISOString().slice(11, 16)} UTC (${config.TRANSPORT_CLASH_MINUTES} minute window)`);
  await tx.transportBookingItem.update({ where: { id: i.id }, data: { driverId: driver.id, vehicleId, assignmentStatus: i.assignmentStatus === 'UNASSIGNED' ? 'ASSIGNED' : i.assignmentStatus, assignedAt: new Date(), driverNotes: input.driverNotes ?? i.driverNotes, updatedBy: actor.userId } });
  await addEvent(tx, actor, b, 'ASSIGNMENT', { message: `Assigned to ${driver.name}${vehicleId ? '' : ' (no vehicle yet)'}`, data: { driverId: driver.id, vehicleId } });
}
const ORDER = ['UNASSIGNED', 'ASSIGNED', 'ON_THE_WAY', 'PICKED_UP', 'DROPPED_OFF'];
export async function dispatchTransport(tx: Tx, scope: Scope, actor: Actor, id: string, input: { status: 'ON_THE_WAY' | 'PICKED_UP' | 'DROPPED_OFF'; itemId?: string }) {
  const b = await operable(tx, scope, id, 'TRANSPORT');
  const items = await tx.transportBookingItem.findMany({ where: { bookingId: b.id }, orderBy: { pickupAt: 'asc' } });
  const i = pick(input.itemId ? items : items.filter((x) => x.assignmentStatus !== 'DROPPED_OFF'), input.itemId);
  if (!i.driverId) throw conflict('Assign a driver first');
  if (ORDER.indexOf(input.status) !== ORDER.indexOf(i.assignmentStatus) + 1) throw conflict(`This trip is ${i.assignmentStatus.toLowerCase().replace(/_/g, ' ')}; the next step is ${ORDER[ORDER.indexOf(i.assignmentStatus) + 1]?.toLowerCase().replace(/_/g, ' ') ?? 'none'}`);
  await tx.transportBookingItem.update({ where: { id: i.id }, data: { assignmentStatus: input.status, ...(input.status === 'PICKED_UP' ? { startedAt: new Date() } : {}), ...(input.status === 'DROPPED_OFF' ? { completedAt: new Date() } : {}), updatedBy: actor.userId } });
  await addEvent(tx, actor, b, 'ASSIGNMENT', { message: `Trip ${input.status.toLowerCase().replace(/_/g, ' ')}` });
  if (input.status === 'DROPPED_OFF' && items.every((x) => x.id === i.id || x.assignmentStatus === 'DROPPED_OFF')) await move(tx, actor, b, 'COMPLETED', { completedAt: new Date() }, 'Completed after drop-off');
}

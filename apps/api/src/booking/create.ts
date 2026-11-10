import type { Prisma, BookingProduct } from '@prisma/client';
import { config } from '../config.js';
import type { Tx } from '../db.js';
import { AppError, badRequest, conflict, forbidden } from '../http.js';
import type { Scope } from '../types.js';
import type { CreateBookingIn } from './schemas.js';
import { queueBookingEmails } from './notify.js';
import { emit, queuePms } from '../integrations/events.js';
import { SYSTEM_ACTOR, addDays, addEvent, audit, localInstant, nextBookingNo, num, round, todayStr, toDate, ymd, type Actor } from './util.js';

interface Line { lineType: 'BASE' | 'ADDON' | 'EXTRA' | 'DISCOUNT'; description: string; quantity: number; unitPrice: number; amount: number; refType?: string; refId?: string }
interface Built { currency: string; startAt: Date; endAt: Date | null; policyId: string | null; lines: Line[]; headcount: number; writeItems: (bookingId: string) => Promise<void> }
const ACTIVE = { status: 'ACTIVE' as const, deletedAt: null };
const fail = (m: string, errors?: unknown) => new AppError(422, m, errors);

/* ------------------------------------------------------------------ hotel */
async function buildHotel(tx: Tx, sid: string, b: Extract<CreateBookingIn, { product: 'HOTEL' }>): Promise<Built> {
  const rt = await tx.roomType.findFirst({ where: { id: b.roomTypeId, supplierId: sid, ...ACTIVE }, include: { hotel: true } });
  if (!rt || rt.hotel.deletedAt || rt.hotel.status !== 'ACTIVE') throw fail('Room type not found or not active', [{ field: 'roomTypeId', message: 'Not found or not active' }]);
  const ci = toDate(b.checkIn), co = toDate(b.checkOut), nights = Math.round((co.getTime() - ci.getTime()) / 864e5);
  if (nights < 1) throw fail('Check-out must be after check-in', [{ field: 'checkOut', message: 'Must be after check-in' }]);
  if (nights > 60) throw fail('The longest stay is 60 nights', [{ field: 'checkOut', message: 'Too long' }]);
  if (b.checkIn < todayStr()) throw fail('Check-in is in the past', [{ field: 'checkIn', message: 'Is in the past' }]);
  if (b.adults > rt.maxAdults * b.rooms || b.children > rt.maxChildren * b.rooms) throw fail(`${rt.name} sleeps at most ${rt.maxAdults} adults and ${rt.maxChildren} children per room`, [{ field: 'adults', message: 'Over room capacity' }]);

  const plans = await tx.ratePlan.findMany({ where: { roomTypeId: rt.id, supplierId: sid, ...ACTIVE, dateFrom: { lte: ci }, dateTo: { gte: addDays(co, -1) }, minStay: { lte: nights } }, orderBy: { price: 'asc' } });
  let plan: (typeof plans)[number] | null = plans[0] ?? null;
  if (b.ratePlanId) { plan = plans.find((p) => p.id === b.ratePlanId) ?? null; if (!plan) throw fail('This rate plan does not cover these dates or the minimum stay', [{ field: 'ratePlanId', message: 'Not valid for these dates' }]); }
  const price = plan ? num(plan.price) : num(rt.basePrice);
  const currency = plan?.currencyCode ?? rt.currencyCode;
  const taken = await tx.$executeRaw`UPDATE room_inventory SET available_units = available_units - ${b.rooms}, updated_at = CURRENT_TIMESTAMP
    WHERE supplier_id = ${sid}::uuid AND room_type_id = ${rt.id}::uuid AND date >= ${b.checkIn}::date AND date < ${b.checkOut}::date
      AND status = 'ACTIVE' AND deleted_at IS NULL AND stop_sell = false AND available_units >= ${b.rooms}`;
  if (taken !== nights) {
    const inv = await tx.roomInventory.findMany({ where: { roomTypeId: rt.id, supplierId: sid, deletedAt: null, date: { gte: ci, lt: co } } });
    const bad: string[] = [];
    for (let i = 0; i < nights; i++) { const d = ymd(addDays(ci, i)); const row = inv.find((r) => ymd(r.date) === d); if (!row || row.stopSell || row.availableUnits < b.rooms) bad.push(d); }
    throw conflict(`Not enough ${rt.name} rooms on: ${bad.join(', ')}`);
  }
  const lines: Line[] = [{ lineType: 'BASE', description: `${rt.hotel.name} · ${rt.name} · ${nights} night${nights > 1 ? 's' : ''} × ${b.rooms} room${b.rooms > 1 ? 's' : ''}${plan ? ` (${plan.name})` : ''}`, quantity: nights * b.rooms, unitPrice: price, amount: round(price * nights * b.rooms), refType: 'RoomType', refId: rt.id }];
  return { currency, startAt: localInstant(b.checkIn, rt.hotel.checkInTime), endAt: localInstant(b.checkOut, rt.hotel.checkOutTime), policyId: plan?.cancellationPolicyId ?? null, lines, headcount: b.adults + b.children,
    writeItems: async (bookingId) => { await tx.hotelBookingItem.create({ data: { supplierId: sid, bookingId, hotelId: rt.hotelId, roomTypeId: rt.id, ratePlanId: plan?.id, checkIn: ci, checkOut: co, nights, rooms: b.rooms, adults: b.adults, children: b.children, mealPlan: plan?.mealPlan ?? 'ROOM_ONLY',
      nightlyRates: Array.from({ length: nights }, (_, i) => ({ date: ymd(addDays(ci, i)), price })), amount: round(price * nights * b.rooms), bedPreference: b.bedPreference }, }); } };
}

/* ------------------------------------------------------------------ trip */
async function buildTrip(tx: Tx, sid: string, b: Extract<CreateBookingIn, { product: 'TRIP' }>): Promise<Built> {
  const sch = await tx.tripSchedule.findFirst({ where: { id: b.scheduleId, supplierId: sid, ...ACTIVE }, include: { trip: true } });
  if (!sch || sch.trip.deletedAt || sch.trip.status !== 'ACTIVE') throw fail('Departure not found or not active', [{ field: 'scheduleId', message: 'Not found or not active' }]);
  const v = await tx.tripVariant.findFirst({ where: { id: b.variantId, tripId: sch.tripId, supplierId: sid, ...ACTIVE } });
  if (!v) throw fail('Variant not found for this trip', [{ field: 'variantId', message: 'Not found for this trip' }]);
  const pax = b.adults + b.children;
  if (pax < v.minPax || (v.maxPax != null && pax > v.maxPax)) throw fail(`${v.name} takes ${v.minPax} to ${v.maxPax ?? 'any number of'} guests`, [{ field: 'adults', message: 'Group size not allowed' }]);
  if (sch.trip.minParticipants > 0 && sch.trip.maxParticipants != null && pax > sch.trip.maxParticipants) throw fail(`This trip takes at most ${sch.trip.maxParticipants} guests`);
  const start = localInstant(ymd(sch.date), sch.startTime);
  if (start.getTime() <= Date.now()) throw conflict('This departure has already left');
  if (b.source === 'WEBSITE' && start.getTime() - sch.cutoffHours * 36e5 < Date.now()) throw conflict(`Bookings for this departure close ${sch.cutoffHours} hours before it starts`);
  const taken = await tx.$executeRaw`UPDATE trip_schedules SET remaining_quota = remaining_quota - ${pax}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sch.id}::uuid AND supplier_id = ${sid}::uuid AND remaining_quota >= ${pax} AND status = 'ACTIVE' AND deleted_at IS NULL`;
  if (taken !== 1) throw conflict(`Only ${Math.max(0, (await tx.tripSchedule.findUnique({ where: { id: sch.id } }))?.remainingQuota ?? 0)} seats left on this departure`);
  const lines: Line[] = [{ lineType: 'BASE', description: `${sch.trip.title} · ${v.name} (adult)`, quantity: b.adults, unitPrice: num(v.adultPrice), amount: round(b.adults * num(v.adultPrice)), refType: 'TripVariant', refId: v.id }];
  if (b.children) lines.push({ lineType: 'BASE', description: `${sch.trip.title} · ${v.name} (child)`, quantity: b.children, unitPrice: num(v.childPrice), amount: round(b.children * num(v.childPrice)), refType: 'TripVariant', refId: v.id });
  for (const a of b.addons) {
    const ad = await tx.tripAddon.findFirst({ where: { id: a.addonId, tripId: sch.tripId, supplierId: sid, ...ACTIVE } });
    if (!ad) throw fail('Add-on not found for this trip', [{ field: 'addons', message: 'Not found for this trip' }]);
    if (ad.currencyCode !== v.currencyCode) throw fail('Add-on currency differs from the trip price currency');
    if (ad.maxQuantity != null && a.quantity > ad.maxQuantity) throw fail(`${ad.name}: at most ${ad.maxQuantity}`, [{ field: 'addons', message: 'Over the maximum quantity' }]);
    const qty = a.quantity * (ad.perPerson ? pax : 1);
    lines.push({ lineType: 'ADDON', description: ad.name, quantity: qty, unitPrice: num(ad.price), amount: round(qty * num(ad.price)), refType: 'TripAddon', refId: ad.id });
  }
  const end = sch.endTime ? localInstant(ymd(sch.date), sch.endTime) : new Date(start.getTime() + sch.trip.durationMinutes * 6e4);
  return { currency: v.currencyCode, startAt: start, endAt: end, policyId: sch.trip.cancellationPolicyId, lines, headcount: pax,
    writeItems: async (bookingId) => { await tx.tripBookingItem.create({ data: { supplierId: sid, bookingId, tripId: sch.tripId, variantId: v.id, scheduleId: sch.id, adults: b.adults, children: b.children, adultPrice: v.adultPrice, childPrice: v.childPrice ?? 0, amount: lines.filter((l) => l.refType === 'TripVariant').reduce((s, l) => s + l.amount, 0), pickupAddress: b.pickupAddress, pickupNotes: b.pickupNotes } }); } };
}

/* ------------------------------------------------------------------ transport */
async function buildTransport(tx: Tx, sid: string, b: Extract<CreateBookingIn, { product: 'TRANSPORT' }>): Promise<Built> {
  let vehicleTypeId: string, price: number, currency: string, minutes: number, serviceId: string | null = null, originZoneId: string | null = null, destinationZoneId: string | null = null, policyId: string | null = null, title: string;
  if (b.serviceId) {
    const svc = await tx.transportService.findFirst({ where: { id: b.serviceId, supplierId: sid, ...ACTIVE } });
    if (!svc) throw fail('Service not found or not active', [{ field: 'serviceId', message: 'Not found or not active' }]);
    ({ vehicleTypeId, currencyCode: currency, originZoneId, destinationZoneId, cancellationPolicyId: policyId } = svc as any);
    price = num(svc.price); minutes = svc.durationMinutes ?? 60; serviceId = svc.id; title = svc.name;
  } else {
    const r = b.route!;
    const rp = await tx.zoneRoutePrice.findFirst({ where: { supplierId: sid, fromZoneId: r.fromZoneId, toZoneId: r.toZoneId, vehicleTypeId: r.vehicleTypeId, ...ACTIVE }, include: { fromZone: true, toZone: true } });
    if (!rp) throw fail('No price is set for this route and vehicle', [{ field: 'route', message: 'No price for this route' }]);
    vehicleTypeId = r.vehicleTypeId; price = num(rp.price); currency = rp.currencyCode; minutes = rp.durationMinutes ?? 60; originZoneId = r.fromZoneId; destinationZoneId = r.toZoneId; title = `${rp.fromZone.name} to ${rp.toZone.name}`;
  }
  const vt = await tx.vehicleType.findFirst({ where: { id: vehicleTypeId, supplierId: sid, ...ACTIVE } });
  if (!vt) throw fail('Vehicle type is not active');
  if (b.passengers > vt.passengerCapacity) throw fail(`${vt.name} seats ${vt.passengerCapacity} passengers`, [{ field: 'passengers', message: 'Over vehicle capacity' }]);
  if (vt.luggageCapacity != null && b.luggage > vt.luggageCapacity) throw fail(`${vt.name} fits ${vt.luggageCapacity} bags`, [{ field: 'luggage', message: 'Over luggage capacity' }]);
  const pickup = new Date(b.pickupAt);
  if (pickup.getTime() <= Date.now()) throw fail('Pick-up time is in the past', [{ field: 'pickupAt', message: 'Is in the past' }]);
  const legs = [{ at: pickup, ret: false }];
  if (b.returnPickupAt) { const r = new Date(b.returnPickupAt); if (r.getTime() <= pickup.getTime()) throw fail('Return must be after the outbound pick-up', [{ field: 'returnPickupAt', message: 'Must be after pick-up' }]); legs.push({ at: r, ret: true }); }
  const lines: Line[] = legs.map((l) => ({ lineType: 'BASE' as const, description: `${title}${l.ret ? ' (return)' : ''} · ${vt.name}`, quantity: 1, unitPrice: price, amount: round(price), refType: serviceId ? 'TransportService' : 'ZoneRoutePrice', refId: serviceId ?? undefined }));
  const last = legs[legs.length - 1]!;
  return { currency, startAt: pickup, endAt: new Date(last.at.getTime() + minutes * 6e4), policyId, lines, headcount: b.passengers,
    writeItems: async (bookingId) => { for (const l of legs) await tx.transportBookingItem.create({ data: { supplierId: sid, bookingId, serviceId, vehicleTypeId, originZoneId, destinationZoneId, pickupAt: l.at, pickupAddress: l.ret ? b.dropoffAddress : b.pickupAddress, dropoffAddress: l.ret ? b.pickupAddress : b.dropoffAddress, flightNumber: b.flightNumber, passengers: b.passengers, luggage: b.luggage, isReturnLeg: l.ret, amount: round(price) } }); } };
}

/* ------------------------------------------------------------------ club */
async function buildClub(tx: Tx, sid: string, b: Extract<CreateBookingIn, { product: 'CLUB' }>): Promise<Built> {
  const club = await tx.club.findFirst({ where: { id: b.clubId, supplierId: sid, ...ACTIVE } });
  if (!club) throw fail('Club not found or not active', [{ field: 'clubId', message: 'Not found or not active' }]);
  if (b.visitDate < todayStr()) throw fail('Visit date is in the past', [{ field: 'visitDate', message: 'Is in the past' }]);
  const ev = b.eventId ? await tx.clubEvent.findFirst({ where: { id: b.eventId, clubId: club.id, supplierId: sid, ...ACTIVE } }) : null;
  if (b.eventId && !ev) throw fail('Event not found for this club', [{ field: 'eventId', message: 'Not found for this club' }]);
  if (ev && ymd(ev.eventDate) !== b.visitDate) throw fail(`This event is on ${ymd(ev.eventDate)}`, [{ field: 'visitDate', message: 'Does not match the event date' }]);
  let unit: number, currency: string, name: string, quota: number | null, ref: { ticketTypeId?: string; tablePackageId?: string };
  if (b.ticketTypeId) {
    const t = await tx.clubTicketType.findFirst({ where: { id: b.ticketTypeId, clubId: club.id, supplierId: sid, ...ACTIVE } });
    if (!t) throw fail('Ticket type not found for this club', [{ field: 'ticketTypeId', message: 'Not found for this club' }]);
    unit = ev?.specialPrice != null ? num(ev.specialPrice) : num(t.price); currency = ev?.specialPrice != null ? (ev.currencyCode ?? t.currencyCode) : t.currencyCode; name = t.name; quota = t.quota; ref = { ticketTypeId: t.id };
    if (b.guestCount > b.quantity * 10) throw fail('Too many guests for this number of tickets');
  } else {
    const t = await tx.clubTablePackage.findFirst({ where: { id: b.tablePackageId!, clubId: club.id, supplierId: sid, ...ACTIVE } });
    if (!t) throw fail('Table package not found for this club', [{ field: 'tablePackageId', message: 'Not found for this club' }]);
    if (b.guestCount > t.capacity * b.quantity) throw fail(`${t.name} seats ${t.capacity}`, [{ field: 'guestCount', message: 'Over table capacity' }]);
    unit = num(t.price) > 0 ? num(t.price) : num(t.minimumSpend); currency = t.currencyCode; name = t.name; quota = t.quota; ref = { tablePackageId: t.id };
  }
  // Club stock is counted from live bookings. The advisory lock makes two sales of the last ticket queue up instead of both succeeding.
  const col = b.ticketTypeId ? 'ticket_type_id' : 'table_package_id', refId = (b.ticketTypeId ?? b.tablePackageId)!;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'club:' + refId + ':' + b.visitDate}))`;
  const sold = async (column: 'ticket_type_id' | 'table_package_id' | 'event_id', id: string, field: 'quantity' | 'guests') => {
    const rows = await tx.$queryRawUnsafe<{ n: bigint | number }[]>(`SELECT COALESCE(SUM(i.${field}), 0) AS n FROM club_booking_items i JOIN bookings b ON b.id = i.booking_id
      WHERE i.supplier_id = $1::uuid AND i.${column} = $2::uuid AND i.visit_date = $3::date AND b.status IN ('PENDING','CONFIRMED','COMPLETED','NO_SHOW') AND b.deleted_at IS NULL`, sid, id, b.visitDate);
    return Number(rows[0]!.n);
  };
  if (quota != null) { const s = await sold(col as any, refId, 'quantity'); if (s + b.quantity > quota) throw conflict(`Only ${Math.max(0, quota - s)} of ${name} left for ${b.visitDate}`); }
  if (ev?.quota != null) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'clubev:' + ev.id}))`; const s = await sold('event_id', ev.id, 'guests'); if (s + b.guestCount > ev.quota) throw conflict(`This event has ${Math.max(0, ev.quota - s)} places left`); }
  const arrival = b.arrivalTime ?? '21:00';
  const start = localInstant(b.visitDate, '12:00'); // the booking window covers the whole visit day for calendars
  const end = localInstant(ymd(addDays(toDate(b.visitDate), 1)), '06:00');
  const amount = round(unit * b.quantity);
  return { currency, startAt: start, endAt: end, policyId: null, lines: [{ lineType: 'BASE', description: `${club.name} · ${name}${ev ? ` · ${ev.title}` : ''}`, quantity: b.quantity, unitPrice: unit, amount, refType: b.ticketTypeId ? 'ClubTicketType' : 'ClubTablePackage', refId }], headcount: b.guestCount,
    writeItems: async (bookingId) => { await tx.clubBookingItem.create({ data: { supplierId: sid, bookingId, clubId: club.id, eventId: ev?.id, ...ref, visitDate: toDate(b.visitDate), arrivalTime: arrival, guests: b.guestCount, quantity: b.quantity, unitPrice: unit, amount, tableLabel: b.tableLabel } }); } };
}

/* ------------------------------------------------------------------ create */
export async function createBooking(tx: Tx, scope: Scope, actor: Actor, sid: string, input: CreateBookingIn) {
  if (input.discount && scope.role === 'SUPPLIER_STAFF') throw forbidden('Only admins can give a discount');
  if (input.source === 'CONCIERGE') {
    if (!input.roomNumber) throw badRequest('A room number is required for guest concierge bookings');
    if (input.confirm) throw badRequest('Guest concierge bookings start as pending. Staff confirm them.');
  }
  const supplier = await tx.supplier.findFirst({ where: { id: sid, deletedAt: null } });
  if (!supplier || supplier.status !== 'ACTIVE') throw badRequest('This supplier is not active');

  // guest and customer
  let customer = input.customerId ? await tx.customer.findFirst({ where: { id: input.customerId, supplierId: sid, deletedAt: null } }) : null;
  if (input.customerId && !customer) throw fail('Customer not found', [{ field: 'customerId', message: 'Not found' }]);
  const guestName = input.guestName ?? customer?.fullName;
  if (!guestName) throw fail('Guest name is required', [{ field: 'guestName', message: 'This field is required' }]);
  const guestEmail = input.guestEmail ?? customer?.email ?? null, guestPhone = input.guestPhone ?? customer?.phone ?? null;
  if (!customer && guestEmail) customer = (await tx.customer.findFirst({ where: { supplierId: sid, email: guestEmail, deletedAt: null } })) ?? (await tx.customer.create({ data: { supplierId: sid, fullName: guestName, email: guestEmail, phone: guestPhone, countryCode: input.guestCountryCode, createdBy: actor.userId } }));

  const built = input.product === 'HOTEL' ? await buildHotel(tx, sid, input) : input.product === 'TRIP' ? await buildTrip(tx, sid, input) : input.product === 'TRANSPORT' ? await buildTransport(tx, sid, input) : await buildClub(tx, sid, input);

  // money
  const dec = (await tx.currency.findUnique({ where: { code: built.currency } }))?.decimals ?? 2;
  const lines: Line[] = built.lines.map((l) => ({ ...l, unitPrice: round(l.unitPrice, dec), amount: round(l.amount, dec) }));
  const subtotal = round(lines.reduce((a, l) => a + l.amount, 0), dec);
  const discount = round(Math.min(input.discount?.amount ?? 0, subtotal), dec);
  if (discount > 0) lines.push({ lineType: 'DISCOUNT', description: `Discount: ${input.discount!.reason}`, quantity: 1, unitPrice: discount, amount: discount });
  const base = subtotal - discount;
  const charges = await tx.taxCharge.findMany({ where: { supplierId: sid, status: 'ACTIVE', deletedAt: null, isInclusive: false, appliesTo: { in: ['ALL', input.product] } }, orderBy: { code: 'asc' } });
  let tax = 0, service = 0;
  const chargeLines: { lineType: 'TAX' | 'SERVICE_CHARGE'; description: string; quantity: number; unitPrice: number; amount: number }[] = [];
  for (const c of charges) {
    const amt = round(base * num(c.ratePct) / 100, dec);
    if (amt <= 0) continue;
    if (c.type === 'TAX') tax += amt; else service += amt;
    chargeLines.push({ lineType: c.type === 'TAX' ? 'TAX' : 'SERVICE_CHARGE', description: `${c.name} ${num(c.ratePct)}%`, quantity: 1, unitPrice: amt, amount: amt });
  }
  tax = round(tax, dec); service = round(service, dec);
  const total = round(base + tax + service, dec);
  const commissionPct = num(supplier.commissionPct);

  const bookingNo = await nextBookingNo(tx, sid, input.product as BookingProduct);
  const now = new Date();
  const status = input.confirm ? 'CONFIRMED' : 'PENDING';
  const booking = await tx.booking.create({ data: {
    supplierId: sid, bookingNo, product: input.product, status, source: input.source, customerId: customer?.id, guestName, guestEmail, guestPhone, guestCountryCode: input.guestCountryCode ?? customer?.countryCode ?? null,
    currencyCode: built.currency, subtotal, taxAmount: tax, serviceCharge: service, discountAmount: discount, totalAmount: total, commissionPct, commissionAmount: round(total * commissionPct / 100, dec),
    startAt: built.startAt, endAt: built.endAt, holdExpiresAt: input.confirm ? null : new Date(now.getTime() + (input.source === 'CONCIERGE' ? config.CONCIERGE_HOLD_MINUTES : config.BOOKING_HOLD_MINUTES) * 6e4), cancellationPolicyId: built.policyId, confirmedAt: input.confirm ? now : null,
    specialRequests: input.specialRequests, roomNumber: input.roomNumber ?? null, internalNotes: input.internalNotes, externalRef: input.externalRef, createdBy: actor.userId } });
  let order = 0;
  for (const l of [...lines, ...chargeLines]) await tx.bookingLine.create({ data: { supplierId: sid, bookingId: booking.id, lineType: l.lineType, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount, refType: (l as Line).refType, refId: (l as Line).refId, sortOrder: order++, createdBy: actor.userId } });
  const guests = input.guests?.length ? input.guests : [{ fullName: guestName, guestType: 'ADULT' as const, isLead: true }];
  if (!guests.some((g) => g.isLead)) guests[0]!.isLead = true;
  for (const g of guests) await tx.bookingGuest.create({ data: { supplierId: sid, bookingId: booking.id, fullName: g.fullName, guestType: g.guestType, age: g.age, isLead: g.isLead, documentNo: g.documentNo, notes: g.notes } });
  await built.writeItems(booking.id);
  await addEvent(tx, actor, booking, 'CREATED', { to: status, message: `Booking ${bookingNo} created (${input.source})`, data: { total, currency: built.currency } });
  if (input.confirm) await addEvent(tx, actor, booking, 'STATUS_CHANGED', { from: 'PENDING', to: 'CONFIRMED', message: 'Confirmed at creation' });
  await audit(tx, actor, 'CREATE', 'Booking', booking.id, sid, undefined, { bookingNo, product: input.product, status, total, currency: built.currency });
  await queueBookingEmails(tx, actor, booking, supplier, lines[0]?.description ?? `${input.product.toLowerCase()} booking`);
  await emit(tx, sid, 'booking.created', { bookingId: booking.id, bookingNo, product: input.product, status, total, currency: built.currency, roomNumber: input.roomNumber ?? null }, `booking.created:${booking.id}`);
  if (input.roomNumber) {
    // Charge to room: post to the PMS folio of the guest who is in that room now. The key makes a retry harmless.
    const stay = await tx.pmsReservation.findFirst({ where: { supplierId: sid, roomNo: input.roomNumber, status: 'IN_HOUSE' }, select: { externalId: true, connectionId: true } });
    if (stay) await queuePms(tx, sid, 'pms.post_charge', { bookingId: booking.id, externalReservationId: stay.externalId, code: input.product, amount: total, currency: built.currency, description: `${bookingNo} ${lines[0]?.description ?? input.product}`.slice(0, 120), idempotencyKey: `charge:${booking.id}` }, `charge:${booking.id}`, 'postCharges');
  }
  return booking;
}

export { SYSTEM_ACTOR };

import { Prisma, type BookingProduct } from '@prisma/client';
import type { Tx } from '../db.js';
import { notFound } from '../http.js';
import type { Scope } from '../types.js';
import { listBookingsQ } from './schemas.js';
import type { z } from 'zod';
import { LIVE_STATUSES, OPEN_STATUSES, addDays, dayRange, num, round, supFilter, supSql, todayStr, toDate, ymd } from './util.js';

type ListQ = z.infer<typeof listBookingsQ>;

export function bookingWhere(s: Scope, q: ListQ): Prisma.BookingWhereInput {
  const and: Prisma.BookingWhereInput[] = [];
  if (q.q) { const c = { contains: q.q, mode: 'insensitive' as const }; and.push({ OR: [{ bookingNo: c }, { guestName: c }, { guestEmail: c }, { guestPhone: c }, { externalRef: c }] }); }
  if (q.status) and.push({ status: { in: q.status.split(',').filter(Boolean) as any } });
  if (q.paymentStatus) and.push({ paymentStatus: { in: q.paymentStatus.split(',').filter(Boolean) as any } });
  const col = q.basis === 'created' ? 'createdAt' : 'startAt';
  if (q.from) and.push({ [col]: { gte: q.basis === 'created' ? dayRange(q.from)[0] : dayRange(q.from)[0] } });
  if (q.to) and.push({ [col]: { lt: dayRange(q.to)[1] } });
  return { ...supFilter(s), ...(q.product ? { product: q.product } : {}), ...(q.source ? { source: q.source } : {}), ...(q.customerId ? { customerId: q.customerId } : {}),
    deletedAt: q.deleted === 'only' ? { not: null } : q.deleted === 'include' ? undefined : null, AND: and };
}

const itemInclude = (product?: BookingProduct) => ({
  ...(!product || product === 'HOTEL' ? { hotelBookingItems: { take: 3, include: { hotel: { select: { name: true } }, roomType: { select: { name: true } } } } } : {}),
  ...(!product || product === 'TRIP' ? { tripBookingItems: { take: 3, include: { trip: { select: { title: true } }, variant: { select: { name: true } }, schedule: { select: { date: true, startTime: true } } } } } : {}),
  ...(!product || product === 'TRANSPORT' ? { transportBookingItems: { take: 3, orderBy: { pickupAt: 'asc' as const }, include: { vehicleType: { select: { name: true } }, driver: { select: { name: true } }, vehicle: { select: { plateNumber: true } } } } } : {}),
  ...(!product || product === 'CLUB' ? { clubBookingItems: { take: 3, include: { club: { select: { name: true } }, event: { select: { title: true } }, ticketType: { select: { name: true } }, tablePackage: { select: { name: true } } } } } : {}),
});

/** A flat one-line summary of what was booked, for list rows and calendars. */
export function summarize(b: any) {
  const h = b.hotelBookingItems?.[0], t = b.tripBookingItems?.[0], r = b.transportBookingItems?.[0], c = b.clubBookingItems?.[0];
  if (h) return { title: `${h.hotel.name} · ${h.roomType.name}`, detail: `${ymd(h.checkIn)} → ${ymd(h.checkOut)} · ${h.nights} night${h.nights > 1 ? 's' : ''} · ${h.rooms} room${h.rooms > 1 ? 's' : ''}`, pax: h.adults + h.children };
  if (t) return { title: t.trip.title, detail: `${ymd(t.schedule.date)} ${t.schedule.startTime} · ${t.variant?.name ?? ''}`.trim(), pax: t.adults + t.children };
  if (r) return { title: `${r.pickupAddress} → ${r.dropoffAddress}`, detail: `${r.vehicleType.name} · ${r.passengers} pax${b.transportBookingItems.length > 1 ? ' · return trip' : ''}`, pax: r.passengers };
  if (c) return { title: `${c.club.name}${c.event ? ' · ' + c.event.title : ''}`, detail: `${ymd(c.visitDate)} · ${c.ticketType?.name ?? c.tablePackage?.name} × ${c.quantity}`, pax: c.guests };
  return { title: '', detail: '', pax: 0 };
}
const shape = (b: any) => { const { hotelBookingItems, tripBookingItems, transportBookingItems, clubBookingItems, ...rest } = b; return { ...rest, summary: summarize(b), balance: round(num(b.totalAmount) - num(b.paidAmount), 2) }; };

export async function listBookings(tx: Tx, s: Scope, q: ListQ) {
  const where = bookingWhere(s, q);
  const orderBy = { [q.sort]: q.dir } as Prisma.BookingOrderByWithRelationInput;
  const [rows, total] = await Promise.all([tx.booking.findMany({ where, orderBy: [orderBy, { id: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit, include: itemInclude(q.product) }), tx.booking.count({ where })]);
  return { rows: rows.map(shape), total };
}

export async function getBookingDetail(tx: Tx, s: Scope, id: string) {
  const b = await tx.booking.findFirst({ where: { id, deletedAt: null, ...supFilter(s) }, include: {
    customer: true, cancellationPolicy: { include: { rules: { where: { deletedAt: null }, orderBy: { hoursBeforeStart: 'desc' } } } },
    bookingLines: { orderBy: { sortOrder: 'asc' } }, bookingGuests: { orderBy: [{ isLead: 'desc' }, { createdAt: 'asc' }] }, payments: { orderBy: { paidAt: 'asc' } }, bookingEvents: { orderBy: { createdAt: 'asc' } },
    hotelBookingItems: { include: { hotel: { select: { id: true, name: true, address: true, contactPhone: true } }, roomType: { select: { id: true, name: true } }, ratePlan: { select: { id: true, name: true } } } },
    tripBookingItems: { include: { trip: { select: { id: true, title: true, meetingPoint: true } }, variant: { select: { id: true, name: true } }, schedule: { select: { id: true, date: true, startTime: true, endTime: true } } } },
    transportBookingItems: { orderBy: { pickupAt: 'asc' }, include: { service: { select: { id: true, name: true } }, vehicleType: { select: { id: true, name: true } }, driver: { select: { id: true, name: true, phone: true } }, vehicle: { select: { id: true, plateNumber: true, make: true, model: true } } } },
    clubBookingItems: { include: { club: { select: { id: true, name: true } }, event: { select: { id: true, title: true } }, ticketType: { select: { id: true, name: true } }, tablePackage: { select: { id: true, name: true } } } },
  } });
  if (!b) throw notFound('Booking not found');
  const { bookingLines, bookingGuests, bookingEvents, hotelBookingItems, tripBookingItems, transportBookingItems, clubBookingItems, cancellationPolicy, ...rest } = b;
  const supplier = await tx.supplier.findUnique({ where: { id: b.supplierId }, select: { id: true, code: true, name: true } });
  return { ...rest, supplier, lines: bookingLines, guests: bookingGuests, events: bookingEvents, balance: round(num(b.totalAmount) - num(b.paidAmount), 2),
    items: { hotel: hotelBookingItems, trip: tripBookingItems, transport: transportBookingItems, club: clubBookingItems }[b.product.toLowerCase() as 'hotel'],
    policy: cancellationPolicy ? { id: cancellationPolicy.id, name: cancellationPolicy.name, rules: cancellationPolicy.rules.map((r) => ({ hoursBeforeStart: r.hoursBeforeStart, refundPercent: r.refundPercent })) } : null };
}

/* ------------------------------------------------------------------ overview (dashboard tiles) */
export async function overview(tx: Tx, s: Scope, product?: BookingProduct) {
  const today = todayStr(), [t0, t1] = dayRange(today), sup = supFilter(s), prod = product ? { product } : {};
  const base = { ...sup, ...prod, deletedAt: null };
  const [createdToday, pending, nextHold, confirmedUpcoming, unpaid, arrivals, departures, tripGuests, pickups, unassigned, clubTonight] = await Promise.all([
    tx.booking.count({ where: { ...base, createdAt: { gte: t0, lt: t1 } } }),
    tx.booking.count({ where: { ...base, status: 'PENDING' } }),
    tx.booking.findFirst({ where: { ...base, status: 'PENDING', holdExpiresAt: { not: null } }, orderBy: { holdExpiresAt: 'asc' }, select: { holdExpiresAt: true, bookingNo: true } }),
    tx.booking.count({ where: { ...base, status: 'CONFIRMED', startAt: { gte: t0, lt: addDays(t0, 7) } } }),
    tx.booking.aggregate({ where: { ...base, status: { in: ['CONFIRMED', 'COMPLETED'] }, paymentStatus: { in: ['UNPAID', 'PARTIAL'] } }, _count: true, _sum: { totalAmount: true, paidAmount: true } }),
    !product || product === 'HOTEL' ? tx.hotelBookingItem.count({ where: { ...sup, checkIn: toDate(today), booking: { status: { in: OPEN_STATUSES }, deletedAt: null } } }) : 0,
    !product || product === 'HOTEL' ? tx.hotelBookingItem.count({ where: { ...sup, checkOut: toDate(today), booking: { status: { in: ['CONFIRMED', 'COMPLETED'] }, deletedAt: null } } }) : 0,
    !product || product === 'TRIP' ? tx.tripBookingItem.aggregate({ where: { ...sup, schedule: { date: toDate(today) }, booking: { status: 'CONFIRMED', deletedAt: null } }, _sum: { adults: true, children: true } }) : null,
    !product || product === 'TRANSPORT' ? tx.transportBookingItem.count({ where: { ...sup, pickupAt: { gte: t0, lt: t1 }, booking: { status: 'CONFIRMED', deletedAt: null } } }) : 0,
    !product || product === 'TRANSPORT' ? tx.transportBookingItem.count({ where: { ...sup, pickupAt: { gte: t0, lt: addDays(t0, 2) }, assignmentStatus: 'UNASSIGNED', booking: { status: 'CONFIRMED', deletedAt: null } } }) : 0,
    !product || product === 'CLUB' ? tx.clubBookingItem.aggregate({ where: { ...sup, visitDate: toDate(today), booking: { status: 'CONFIRMED', deletedAt: null } }, _sum: { guests: true, checkedInCount: true } }) : null,
  ]);
  return { date: today, createdToday, pending, nextHoldExpiry: nextHold, confirmedNext7Days: confirmedUpcoming,
    unpaid: { count: unpaid._count, outstanding: round(num(unpaid._sum.totalAmount) - num(unpaid._sum.paidAmount), 2) },
    hotel: { arrivals, departures }, trips: { guestsToday: (tripGuests?._sum.adults ?? 0) + (tripGuests?._sum.children ?? 0) }, transport: { pickupsToday: pickups, unassignedNext2Days: unassigned },
    club: { guestsExpectedTonight: clubTonight?._sum.guests ?? 0, checkedInTonight: clubTonight?._sum.checkedInCount ?? 0 } };
}

/* ------------------------------------------------------------------ boards (what to do today) */
const flat = (b: any) => ({ id: b.id, bookingNo: b.bookingNo, status: b.status, paymentStatus: b.paymentStatus, balance: round(num(b.totalAmount) - num(b.paidAmount), 2), guestName: b.guestName, guestPhone: b.guestPhone, specialRequests: b.specialRequests, currencyCode: b.currencyCode });

export async function hotelBoard(tx: Tx, s: Scope, date: string, hotelId?: string) {
  const sup = supFilter(s), d = toDate(date), live = { status: { in: OPEN_STATUSES.concat(['COMPLETED']) }, deletedAt: null };
  const inc = { booking: true, roomType: { select: { name: true } }, hotel: { select: { name: true } } } as const;
  const hf = hotelId ? { hotelId } : {};
  const [arrivals, departures, inHouse, inventory] = await Promise.all([
    tx.hotelBookingItem.findMany({ where: { ...sup, ...hf, checkIn: d, booking: { ...live } }, include: inc, orderBy: { createdAt: 'asc' } }),
    tx.hotelBookingItem.findMany({ where: { ...sup, ...hf, checkOut: d, booking: { status: { in: ['CONFIRMED', 'COMPLETED'] }, deletedAt: null } }, include: inc, orderBy: { createdAt: 'asc' } }),
    tx.hotelBookingItem.findMany({ where: { ...sup, ...hf, checkIn: { lt: d }, checkOut: { gt: d }, booking: { status: 'CONFIRMED', deletedAt: null } }, include: inc, orderBy: { roomNumber: 'asc' } }),
    tx.roomInventory.findMany({ where: { ...sup, date: d, deletedAt: null, ...(hotelId ? { roomType: { hotelId } } : {}) }, include: { roomType: { select: { id: true, name: true, hotel: { select: { name: true } } } } } }),
  ]);
  const row = (i: any) => ({ itemId: i.id, ...flat(i.booking), hotel: i.hotel.name, roomType: i.roomType.name, rooms: i.rooms, adults: i.adults, children: i.children, nights: i.nights, checkIn: i.checkIn, checkOut: i.checkOut, roomNumber: i.roomNumber, checkedInAt: i.checkedInAt, checkedOutAt: i.checkedOutAt });
  const totals = inventory.reduce((a, r) => ({ total: a.total + r.totalUnits, available: a.available + r.availableUnits }), { total: 0, available: 0 });
  return { date, arrivals: arrivals.map(row), departures: departures.map(row), inHouse: inHouse.map(row),
    occupancy: { totalUnits: totals.total, sold: totals.total - totals.available, percent: totals.total ? round((totals.total - totals.available) / totals.total * 100, 1) : 0,
      byRoomType: inventory.map((r) => ({ roomTypeId: r.roomType.id, roomType: r.roomType.name, hotel: r.roomType.hotel.name, total: r.totalUnits, available: r.availableUnits, stopSell: r.stopSell })) } };
}

export async function tripsBoard(tx: Tx, s: Scope, from: string, to: string, tripId?: string) {
  const sup = supFilter(s);
  const sch = await tx.tripSchedule.findMany({ where: { ...sup, deletedAt: null, date: { gte: toDate(from), lte: toDate(to) }, ...(tripId ? { tripId } : {}) }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: { trip: { select: { title: true, code: true } }, tripBookingItems: { where: { booking: { status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] }, deletedAt: null } }, include: { booking: true } } } });
  return { from, to, departures: sch.map((x) => {
    const pax = (st: string[]) => x.tripBookingItems.filter((i) => st.includes(i.booking.status)).reduce((a, i) => a + i.adults + i.children, 0);
    return { scheduleId: x.id, tripId: x.tripId, trip: x.trip.title, date: x.date, startTime: x.startTime, endTime: x.endTime, quota: x.quota, remaining: x.remainingQuota, status: x.status,
      confirmedGuests: pax(['CONFIRMED', 'COMPLETED']), pendingGuests: pax(['PENDING']), noShowGuests: pax(['NO_SHOW']),
      bookings: x.tripBookingItems.map((i) => ({ itemId: i.id, ...flat(i.booking), adults: i.adults, children: i.children, pickupAddress: i.pickupAddress, checkedInAt: i.checkedInAt, participantsShown: i.participantsShown })) };
  }) };
}

export async function transportBoard(tx: Tx, s: Scope, date: string, days: number) {
  const sup = supFilter(s), [t0] = dayRange(date), t1 = addDays(t0, days);
  const [items, drivers, vehicles] = await Promise.all([
    tx.transportBookingItem.findMany({ where: { ...sup, pickupAt: { gte: t0, lt: t1 }, booking: { status: { in: OPEN_STATUSES.concat(['COMPLETED']) }, deletedAt: null } }, orderBy: { pickupAt: 'asc' },
      include: { booking: true, vehicleType: { select: { name: true } }, driver: { select: { id: true, name: true, phone: true } }, vehicle: { select: { id: true, plateNumber: true } } } }),
    tx.driver.findMany({ where: { ...sup, status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true, phone: true, licenseExpiry: true }, orderBy: { name: 'asc' } }),
    tx.vehicle.findMany({ where: { ...sup, status: 'ACTIVE', deletedAt: null }, select: { id: true, plateNumber: true, vehicleTypeId: true, driverId: true, insuranceExpiry: true }, orderBy: { plateNumber: 'asc' } }),
  ]);
  return { date, days, jobs: items.map((i) => ({ itemId: i.id, ...flat(i.booking), pickupAt: i.pickupAt, pickupAddress: i.pickupAddress, dropoffAddress: i.dropoffAddress, flightNumber: i.flightNumber, passengers: i.passengers, luggage: i.luggage, isReturnLeg: i.isReturnLeg,
      vehicleType: i.vehicleType.name, vehicleTypeId: i.vehicleTypeId, assignmentStatus: i.assignmentStatus, driver: i.driver, vehicle: i.vehicle, driverNotes: i.driverNotes })),
    unassigned: items.filter((i) => i.assignmentStatus === 'UNASSIGNED' && i.booking.status === 'CONFIRMED').length, drivers, vehicles };
}

export async function clubBoard(tx: Tx, s: Scope, date: string, clubId?: string) {
  const sup = supFilter(s);
  const [items, events] = await Promise.all([
    tx.clubBookingItem.findMany({ where: { ...sup, visitDate: toDate(date), ...(clubId ? { clubId } : {}), booking: { status: { in: OPEN_STATUSES.concat(['COMPLETED', 'NO_SHOW']) }, deletedAt: null } }, orderBy: [{ arrivalTime: 'asc' }, { createdAt: 'asc' }],
      include: { booking: true, club: { select: { name: true } }, event: { select: { title: true } }, ticketType: { select: { name: true } }, tablePackage: { select: { name: true } } } }),
    tx.clubEvent.findMany({ where: { ...sup, eventDate: toDate(date), deletedAt: null, ...(clubId ? { clubId } : {}) }, include: { club: { select: { name: true } } } }),
  ]);
  const conf = items.filter((i) => i.booking.status !== 'PENDING');
  return { date, events: events.map((e) => ({ id: e.id, title: e.title, club: e.club.name, startTime: e.startTime, endTime: e.endTime, quota: e.quota })),
    totals: { guestsExpected: conf.reduce((a, i) => a + i.guests, 0), checkedIn: conf.reduce((a, i) => a + i.checkedInCount, 0), tables: conf.filter((i) => i.tablePackageId).length },
    guestList: items.map((i) => ({ itemId: i.id, ...flat(i.booking), club: i.club.name, event: i.event?.title ?? null, product: i.ticketType?.name ?? i.tablePackage?.name, isTable: !!i.tablePackageId, tableLabel: i.tableLabel, guests: i.guests, quantity: i.quantity, arrivalTime: i.arrivalTime, checkedInCount: i.checkedInCount, checkedInAt: i.checkedInAt })) };
}

/* ------------------------------------------------------------------ availability (for the New booking form) */
export async function hotelAvailability(tx: Tx, s: Scope, hotelId: string, checkIn: string, checkOut: string, rooms: number) {
  const sup = supFilter(s), ci = toDate(checkIn), co = toDate(checkOut), nights = Math.round((co.getTime() - ci.getTime()) / 864e5);
  const types = await tx.roomType.findMany({ where: { ...sup, hotelId, deletedAt: null, status: 'ACTIVE' }, orderBy: { basePrice: 'asc' } });
  const out = [];
  for (const rt of types) {
    const inv = await tx.roomInventory.findMany({ where: { ...sup, roomTypeId: rt.id, deletedAt: null, date: { gte: ci, lt: co } } });
    const byDay = new Map(inv.map((r) => [ymd(r.date), r]));
    const days = Array.from({ length: nights }, (_, i) => { const d = ymd(addDays(ci, i)); const r = byDay.get(d); return { date: d, available: r && !r.stopSell && r.status === 'ACTIVE' ? r.availableUnits : 0, stopSell: r?.stopSell ?? false }; });
    const plans = await tx.ratePlan.findMany({ where: { ...sup, roomTypeId: rt.id, deletedAt: null, status: 'ACTIVE', dateFrom: { lte: ci }, dateTo: { gte: addDays(co, -1) }, minStay: { lte: nights } }, orderBy: { price: 'asc' } });
    const min = Math.min(...days.map((d) => d.available));
    out.push({ roomTypeId: rt.id, name: rt.name, maxAdults: rt.maxAdults, maxChildren: rt.maxChildren, available: nights ? Math.max(0, min) : 0, canBook: min >= rooms && nights > 0, days,
      ratePlans: plans.map((p) => ({ id: p.id, name: p.name, mealPlan: p.mealPlan, pricePerNight: p.price, total: round(num(p.price) * nights * rooms, 2), currencyCode: p.currencyCode, cancellationPolicyId: p.cancellationPolicyId })), basePrice: rt.basePrice, currencyCode: rt.currencyCode });
  }
  return { hotelId, checkIn, checkOut, nights, rooms, roomTypes: out };
}
export async function tripAvailability(tx: Tx, s: Scope, tripId: string, from: string, to: string, pax: number) {
  const sch = await tx.tripSchedule.findMany({ where: { ...supFilter(s), tripId, deletedAt: null, status: 'ACTIVE', date: { gte: toDate(from), lte: toDate(to) } }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] });
  const variants = await tx.tripVariant.findMany({ where: { ...supFilter(s), tripId, deletedAt: null, status: 'ACTIVE' }, orderBy: { adultPrice: 'asc' } });
  const addons = await tx.tripAddon.findMany({ where: { ...supFilter(s), tripId, deletedAt: null, status: 'ACTIVE' } });
  return { tripId, variants, addons, departures: sch.map((x) => ({ scheduleId: x.id, date: x.date, startTime: x.startTime, endTime: x.endTime, quota: x.quota, remaining: x.remainingQuota, canBook: x.remainingQuota >= pax, cutoffHours: x.cutoffHours })) };
}
export async function transportAvailability(tx: Tx, s: Scope, vehicleTypeId: string, pickupAt: Date, clashMinutes: number) {
  const sup = supFilter(s), w = clashMinutes * 6e4;
  const busy = await tx.transportBookingItem.findMany({ where: { ...sup, pickupAt: { gt: new Date(pickupAt.getTime() - w), lt: new Date(pickupAt.getTime() + w) }, booking: { status: { in: OPEN_STATUSES }, deletedAt: null }, OR: [{ driverId: { not: null } }, { vehicleId: { not: null } }] }, select: { driverId: true, vehicleId: true } });
  const bd = new Set(busy.map((b) => b.driverId)), bv = new Set(busy.map((b) => b.vehicleId));
  const [drivers, vehicles] = await Promise.all([tx.driver.findMany({ where: { ...sup, deletedAt: null, status: 'ACTIVE' }, select: { id: true, name: true } }), tx.vehicle.findMany({ where: { ...sup, deletedAt: null, status: 'ACTIVE', vehicleTypeId }, select: { id: true, plateNumber: true, driverId: true } })]);
  return { pickupAt, windowMinutes: clashMinutes, drivers: drivers.map((d) => ({ ...d, free: !bd.has(d.id) })), vehicles: vehicles.map((v) => ({ ...v, free: !bv.has(v.id) })) };
}
export async function clubAvailability(tx: Tx, s: Scope, clubId: string, date: string) {
  const sup = supFilter(s), d = toDate(date);
  const [club, tickets, tables, events] = await Promise.all([
    tx.club.findFirst({ where: { ...sup, id: clubId, deletedAt: null } }), tx.clubTicketType.findMany({ where: { ...sup, clubId, deletedAt: null, status: 'ACTIVE' } }), tx.clubTablePackage.findMany({ where: { ...sup, clubId, deletedAt: null, status: 'ACTIVE' } }), tx.clubEvent.findMany({ where: { ...sup, clubId, eventDate: d, deletedAt: null, status: 'ACTIVE' } })]);
  if (!club) throw notFound('Club not found');
  const sold = async (field: 'ticketTypeId' | 'tablePackageId', id: string) => (await tx.clubBookingItem.aggregate({ where: { ...sup, [field]: id, visitDate: d, booking: { status: { in: LIVE_STATUSES }, deletedAt: null } }, _sum: { quantity: true } }))._sum.quantity ?? 0;
  return { clubId, date, events,
    tickets: await Promise.all(tickets.map(async (t) => { const n = await sold('ticketTypeId', t.id); return { id: t.id, name: t.name, price: t.price, currencyCode: t.currencyCode, quota: t.quota, sold: n, left: t.quota == null ? null : Math.max(0, t.quota - n) }; })),
    tables: await Promise.all(tables.map(async (t) => { const n = await sold('tablePackageId', t.id); return { id: t.id, name: t.name, capacity: t.capacity, price: num(t.price) > 0 ? t.price : t.minimumSpend, currencyCode: t.currencyCode, quota: t.quota, sold: n, left: t.quota == null ? null : Math.max(0, t.quota - n) }; })) };
}

/**
 * Demo bookings for the two demo suppliers: customers, and about 20 bookings per supplier across hotel, trip,
 * transport and club in every status, with payments and a timeline. Run AFTER prisma/seed.ts:
 *   npm run db:seed:bookings
 * Safe to re-run: it does nothing when bookings already exist.
 * Dates are relative to today, so the demo always has arrivals, departures and pending holds around "now".
 */
import { PrismaClient, Prisma, BookingProduct, BookingStatus, PaymentMethod } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });
const day = (n: number, h = 0) => { const d = new Date(); d.setUTCHours(h, 0, 0, 0); d.setUTCDate(d.getUTCDate() + n); return d; };
const dateOnly = (n: number) => day(n, 0);
const money = (n: number) => Math.round(n);
const PREFIX: Record<BookingProduct, string> = { HOTEL: 'HTL', TRIP: 'TRP', TRANSPORT: 'TRN', CLUB: 'CLB' };
const NAMES = [['Emma Wilson', 'GB', 'emma.wilson@example.com', '+44 7700 900123'], ['Liam Chen', 'SG', 'liam.chen@example.com', '+65 8123 4567'], ['Sofia Rossi', 'IT', 'sofia.rossi@example.com', '+39 333 123 4567'],
  ['Noah Becker', 'DE', 'noah.becker@example.com', '+49 151 2345 6789'], ['Mia Tanaka', 'JP', 'mia.tanaka@example.com', '+81 90 1234 5678'], ['Oliver Smith', 'AU', 'oliver.smith@example.com', '+61 412 345 678'],
  ['Chloe Dubois', 'FR', 'chloe.dubois@example.com', '+33 6 12 34 56 78'], ['Lucas van Dijk', 'NL', 'lucas.vandijk@example.com', '+31 6 1234 5678']];

type Tx = Prisma.TransactionClient;
type Pay = { amount: number; method?: PaymentMethod; refund?: number };
interface Spec { product: BookingProduct; status: BookingStatus; startAt: Date; endAt?: Date; created: number; customer: number; source?: 'ADMIN' | 'WEBSITE' | 'OTA' | 'PHONE' | 'WALK_IN';
  lines: { type?: 'BASE' | 'ADDON' | 'EXTRA'; description: string; qty: number; unit: number }[]; hotelService?: boolean; pay: Pay[]; hold?: boolean; cancelReason?: string; notes?: string; special?: string; guests?: number; item: (bookingId: string) => Promise<void>; }

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.role', 'SUPER_ADMIN', true), set_config('app.supplier_id', '', true)`;
    if (await tx.booking.count()) { console.log('Bookings already exist, nothing to do.'); return; }
    const suppliers = await tx.supplier.findMany({ where: { isPlatform: false }, orderBy: { code: 'asc' } });
    if (!suppliers.length) throw new Error('Run prisma/seed.ts first.');
    for (const sup of suppliers) await seedSupplier(tx, sup);
  }, { timeout: 120000, maxWait: 20000 });
  console.log('Booking demo data created.');
}

async function seedSupplier(tx: Tx, sup: { id: string; code: string; commissionPct: Prisma.Decimal }) {
  const S = sup.id;
  const admin = await tx.user.findFirst({ where: { supplierId: S, role: 'SUPPLIER_ADMIN' } });
  const hotel = await tx.hotel.findFirstOrThrow({ where: { supplierId: S } });
  const roomTypes = await tx.roomType.findMany({ where: { supplierId: S, hotelId: hotel.id }, orderBy: { basePrice: 'asc' } });
  const ratePlans = await tx.ratePlan.findMany({ where: { supplierId: S }, orderBy: { price: 'asc' } });
  const trips = await tx.trip.findMany({ where: { supplierId: S }, orderBy: { code: 'asc' } });
  const variants = await tx.tripVariant.findMany({ where: { supplierId: S } });
  const services = await tx.transportService.findMany({ where: { supplierId: S }, orderBy: { code: 'asc' } });
  const vehicles = await tx.vehicle.findMany({ where: { supplierId: S } });
  const clubs = await tx.club.findMany({ where: { supplierId: S }, orderBy: { code: 'asc' } });
  const tickets = await tx.clubTicketType.findMany({ where: { supplierId: S } });
  const tables = await tx.clubTablePackage.findMany({ where: { supplierId: S } });
  const events = await tx.clubEvent.findMany({ where: { supplierId: S }, orderBy: { eventDate: 'asc' } });
  const policy = await tx.cancellationPolicy.findFirst({ where: { supplierId: S } });
  const pct = Number(sup.commissionPct);

  const customers: Awaited<ReturnType<typeof tx.customer.create>>[] = [];
  for (const [fullName, countryCode, email, phone] of NAMES) customers.push(await tx.customer.create({ data: { supplierId: S, fullName, countryCode, email, phone, createdBy: admin?.id } }));

  // Past trip departures so completed and no-show trip bookings have a real schedule row.
  const pastSchedules: Record<string, string> = {};
  for (const t of trips) {
    const s = await tx.tripSchedule.create({ data: { supplierId: S, tripId: t.id, date: dateOnly(-6), startTime: '08:00', endTime: '14:00', quota: 12, remainingQuota: 6, cutoffHours: 12 } });
    pastSchedules[t.id] = s.id;
  }
  const futureSchedule = async (tripId: string, offset: number) => (await tx.tripSchedule.findFirst({ where: { supplierId: S, tripId, date: { gte: dateOnly(offset) } }, orderBy: { date: 'asc' } }))!;

  const counters: Record<string, number> = {};
  async function make(spec: Spec) {
    const c = customers[spec.customer % customers.length];
    const subtotal = spec.lines.reduce((a, l) => a + l.qty * l.unit, 0);
    const tax = money(subtotal * 0.11), service = spec.product === 'HOTEL' ? money(subtotal * 0.10) : 0;
    const total = subtotal + tax + service;
    const created = day(spec.created, 3);
    const period = `${String(created.getUTCFullYear()).slice(2)}${String(created.getUTCMonth() + 1).padStart(2, '0')}`;
    const key = spec.product + period; counters[key] = (counters[key] ?? 0) + 1;
    const bookingNo = `${PREFIX[spec.product]}-${period}-${String(counters[key]).padStart(4, '0')}`;
    const confirmedAt = ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(spec.status) ? new Date(created.getTime() + 36e5) : null;
    const cancelled = spec.status === 'CANCELLED';
    const b = await tx.booking.create({ data: {
      supplierId: S, bookingNo, product: spec.product, status: spec.status, source: spec.source ?? 'ADMIN', customerId: c.id, guestName: c.fullName, guestEmail: c.email, guestPhone: c.phone, guestCountryCode: c.countryCode,
      currencyCode: 'IDR', subtotal, taxAmount: tax, serviceCharge: service, discountAmount: 0, totalAmount: total, commissionPct: pct, commissionAmount: money(total * pct / 100),
      startAt: spec.startAt, endAt: spec.endAt, holdExpiresAt: spec.hold ? new Date(Date.now() + 5 * 36e5) : null, cancellationPolicyId: policy?.id,
      confirmedAt, cancelledAt: cancelled ? new Date(created.getTime() + 72e5) : null, cancelReason: cancelled ? spec.cancelReason : null, completedAt: spec.status === 'COMPLETED' ? spec.endAt ?? spec.startAt : null,
      specialRequests: spec.special, internalNotes: spec.notes, createdBy: admin?.id, createdAt: created } });
    await tx.bookingSequence.upsert({ where: { supplierId_product_period: { supplierId: S, product: spec.product, period } }, update: { lastValue: counters[key] }, create: { supplierId: S, product: spec.product, period, lastValue: counters[key] } });
    let order = 0;
    for (const l of spec.lines) await tx.bookingLine.create({ data: { supplierId: S, bookingId: b.id, lineType: l.type ?? 'BASE', description: l.description, quantity: l.qty, unitPrice: l.unit, amount: l.qty * l.unit, sortOrder: order++ } });
    await tx.bookingLine.create({ data: { supplierId: S, bookingId: b.id, lineType: 'TAX', description: 'VAT 11%', quantity: 1, unitPrice: tax, amount: tax, sortOrder: order++ } });
    if (service) await tx.bookingLine.create({ data: { supplierId: S, bookingId: b.id, lineType: 'SERVICE_CHARGE', description: 'Service charge 10%', quantity: 1, unitPrice: service, amount: service, sortOrder: order++ } });
    await tx.bookingGuest.create({ data: { supplierId: S, bookingId: b.id, fullName: c.fullName, guestType: 'ADULT', isLead: true } });
    for (let i = 1; i < (spec.guests ?? 1); i++) await tx.bookingGuest.create({ data: { supplierId: S, bookingId: b.id, fullName: `${c.fullName.split(' ')[0]}'s guest ${i}`, guestType: 'ADULT' } });
    await spec.item(b.id);
    const ev = (eventType: 'CREATED' | 'STATUS_CHANGED' | 'PAYMENT' | 'REFUND' | 'NOTE', at: Date, message: string, from?: BookingStatus, to?: BookingStatus) =>
      tx.bookingEvent.create({ data: { supplierId: S, bookingId: b.id, eventType, fromStatus: from, toStatus: to, message, actorId: admin?.id, actorName: admin?.name ?? 'Seed', createdAt: at } });
    await ev('CREATED', created, `Booking ${bookingNo} created from ${spec.source ?? 'ADMIN'}`);
    if (confirmedAt) await ev('STATUS_CHANGED', confirmedAt, 'Confirmed', 'PENDING', 'CONFIRMED');
    if (spec.status === 'COMPLETED') await ev('STATUS_CHANGED', b.completedAt!, 'Completed', 'CONFIRMED', 'COMPLETED');
    if (spec.status === 'NO_SHOW') await ev('STATUS_CHANGED', spec.startAt, 'Guest did not show up', 'CONFIRMED', 'NO_SHOW');
    if (cancelled) await ev('STATUS_CHANGED', b.cancelledAt!, spec.cancelReason ?? 'Cancelled', 'PENDING', 'CANCELLED');
    if (spec.status === 'EXPIRED') await ev('STATUS_CHANGED', new Date(created.getTime() + 864e5), 'Hold expired without payment', 'PENDING', 'EXPIRED');
    if (spec.notes) await ev('NOTE', new Date(created.getTime() + 18e5), spec.notes);
    for (const p of spec.pay) {
      const pay = await tx.payment.create({ data: { supplierId: S, bookingId: b.id, kind: 'PAYMENT', method: p.method ?? 'BANK_TRANSFER', amount: p.amount, currencyCode: 'IDR', reference: `PAY-${bookingNo}`, paidAt: new Date(created.getTime() + 2 * 36e5), recordedBy: admin?.id } });
      await ev('PAYMENT', pay.paidAt, `Payment received: IDR ${p.amount.toLocaleString('en-US')}`);
      if (p.refund) {
        const r = await tx.payment.create({ data: { supplierId: S, bookingId: b.id, kind: 'REFUND', method: p.method ?? 'BANK_TRANSFER', amount: p.refund, currencyCode: 'IDR', reference: `RF-${bookingNo}`, refundOfId: pay.id, paidAt: new Date(created.getTime() + 8e6), recordedBy: admin?.id } });
        await ev('REFUND', r.paidAt, `Refund issued: IDR ${p.refund.toLocaleString('en-US')} (cancellation policy)`);
      }
    }
    return { id: b.id, total };
  }
  const totalOf = (lines: Spec['lines'], product: BookingProduct) => { const s = lines.reduce((a, l) => a + l.qty * l.unit, 0); return s + money(s * 0.11) + (product === 'HOTEL' ? money(s * 0.10) : 0); };

  // ---------------- hotel
  const rate = (i: number) => ratePlans.find((r) => r.roomTypeId === roomTypes[i % roomTypes.length].id) ?? ratePlans[0];
  const stay = async (room: number, inN: number, outN: number, rooms: number, adults: number, bookingId: string, extra: Partial<Prisma.HotelBookingItemUncheckedCreateInput> = {}) => {
    const rt = roomTypes[room % roomTypes.length], rp = rate(room), nights = outN - inN, price = Number(rp.price);
    await tx.hotelBookingItem.create({ data: { supplierId: S, bookingId, hotelId: hotel.id, roomTypeId: rt.id, ratePlanId: rp.id, checkIn: dateOnly(inN), checkOut: dateOnly(outN), nights, rooms, adults, children: 0, mealPlan: rp.mealPlan,
      nightlyRates: Array.from({ length: nights }, (_, i) => ({ date: dateOnly(inN + i).toISOString().slice(0, 10), price })), amount: price * nights * rooms, ...extra } });
  };
  const hl = (room: number, inN: number, outN: number, rooms: number) => { const rt = roomTypes[room % roomTypes.length], rp = rate(room); return [{ description: `${rt.name} · ${outN - inN} night${outN - inN > 1 ? 's' : ''} × ${rooms} room${rooms > 1 ? 's' : ''}`, qty: (outN - inN) * rooms, unit: Number(rp.price) }]; };
  const H = (o: { room: number; inN: number; outN: number; rooms?: number; status: BookingStatus; created: number; cust: number; pay: (t: number) => Pay[]; extra?: Partial<Spec>; item?: Partial<Prisma.HotelBookingItemUncheckedCreateInput> }) => {
    const rooms = o.rooms ?? 1, lines = hl(o.room, o.inN, o.outN, rooms), t = totalOf(lines, 'HOTEL');
    return make({ product: 'HOTEL', status: o.status, startAt: day(o.inN, 6), endAt: day(o.outN, 4), created: o.created, customer: o.cust, lines, pay: o.pay(t), guests: 2,
      item: (id) => stay(o.room, o.inN, o.outN, rooms, 2, id, o.item), ...o.extra });
  };
  await H({ room: 0, inN: -20, outN: -17, status: 'COMPLETED', created: -34, cust: 0, pay: (t) => [{ amount: t }], item: { checkedInAt: day(-20, 7), checkedOutAt: day(-17, 3), roomNumber: '101' }, extra: { source: 'WEBSITE' } });
  await H({ room: 1, inN: -9, outN: -5, status: 'COMPLETED', created: -21, cust: 1, pay: (t) => [{ amount: t, method: 'CARD' }], item: { checkedInAt: day(-9, 7), checkedOutAt: day(-5, 3), roomNumber: '204' }, extra: { source: 'OTA', notes: 'Late checkout approved until 14:00.' } });
  await H({ room: 1, inN: -1, outN: 3, status: 'CONFIRMED', created: -12, cust: 2, pay: (t) => [{ amount: t }], item: { checkedInAt: day(-1, 8), roomNumber: '305' }, extra: { special: 'High floor, quiet room. Anniversary trip.' } });
  await H({ room: 0, inN: 0, outN: 2, rooms: 2, status: 'CONFIRMED', created: -4, cust: 3, pay: (t) => [{ amount: money(t * 0.5), method: 'CARD' }] });
  await H({ room: 2, inN: 6, outN: 10, status: 'CONFIRMED', created: -2, cust: 4, pay: (t) => [{ amount: t }], extra: { source: 'WEBSITE' } });
  await H({ room: 0, inN: 14, outN: 17, status: 'PENDING', created: 0, cust: 5, pay: () => [], extra: { hold: true, source: 'PHONE', special: 'Airport pickup needed.' } });
  await H({ room: 1, inN: 8, outN: 11, status: 'CANCELLED', created: -10, cust: 6, pay: (t) => [{ amount: money(t * 0.4), refund: money(t * 0.2) }], extra: { cancelReason: 'Guest changed travel dates' } });

  // ---------------- trips
  const tripLines = (v: (typeof variants)[number], adults: number, children: number, title: string) => [
    ...(adults ? [{ description: `${title} · ${v.name} (adult)`, qty: adults, unit: Number(v.adultPrice) }] : []),
    ...(children ? [{ description: `${title} · ${v.name} (child)`, qty: children, unit: Number(v.childPrice ?? 0) }] : [])];
  const T = async (o: { trip: number; v: number; past?: boolean; off?: number; status: BookingStatus; created: number; cust: number; adults: number; children?: number; pay: (t: number) => Pay[]; extra?: Partial<Spec>; item?: Partial<Prisma.TripBookingItemUncheckedCreateInput> }) => {
    const trip = trips[o.trip % trips.length], tv = variants.filter((x) => x.tripId === trip.id), v = tv[o.v % tv.length];
    const sch = o.past ? await tx.tripSchedule.findUniqueOrThrow({ where: { id: pastSchedules[trip.id] } }) : await futureSchedule(trip.id, o.off ?? 1);
    const children = o.children ?? 0, lines = tripLines(v, o.adults, children, trip.title), t = totalOf(lines, 'TRIP');
    const [hh] = sch.startTime.split(':').map(Number);
    const start = new Date(sch.date); start.setUTCHours(hh - 8, 0, 0, 0);
    return make({ product: 'TRIP', status: o.status, startAt: start, endAt: new Date(start.getTime() + trip.durationMinutes * 6e4), created: o.created, customer: o.cust, lines, pay: o.pay(t), guests: o.adults + children,
      item: async (id) => { await tx.tripBookingItem.create({ data: { supplierId: S, bookingId: id, tripId: trip.id, variantId: v.id, scheduleId: sch.id, adults: o.adults, children, adultPrice: v.adultPrice, childPrice: v.childPrice ?? 0, amount: lines.reduce((a, l) => a + l.qty * l.unit, 0), pickupAddress: `${hotel.name}, lobby`, ...o.item } }); }, ...o.extra });
  };
  await T({ trip: 0, v: 0, past: true, status: 'COMPLETED', created: -15, cust: 4, adults: 2, children: 1, pay: (t) => [{ amount: t }], item: { checkedInAt: day(-6, 0), participantsShown: 3 } });
  await T({ trip: 1, v: 1, past: true, status: 'NO_SHOW', created: -12, cust: 5, adults: 2, pay: (t) => [{ amount: money(t * 0.3) }], item: { participantsShown: 0 }, extra: { notes: 'Called twice, no answer. Deposit kept.' } });
  await T({ trip: 0, v: 0, off: 1, status: 'CONFIRMED', created: -3, cust: 0, adults: 2, pay: (t) => [{ amount: t, method: 'CARD' }], extra: { source: 'WEBSITE' } });
  await T({ trip: 1, v: 0, off: 2, status: 'CONFIRMED', created: -1, cust: 6, adults: 3, children: 1, pay: (t) => [{ amount: money(t * 0.5) }] });
  await T({ trip: 0, v: 1, off: 3, status: 'PENDING', created: 0, cust: 7, adults: 4, pay: () => [], extra: { hold: true, source: 'OTA' } });
  await T({ trip: 1, v: 0, off: 4, status: 'CANCELLED', created: -6, cust: 2, adults: 2, pay: (t) => [{ amount: t, refund: t }], extra: { cancelReason: 'Weather forecast, guest cancelled 3 days ahead' } });

  // ---------------- transport
  const R = async (o: { svc: number; vehicle?: number; at: number; hour: number; status: BookingStatus; created: number; cust: number; pax: number; pay: (t: number) => Pay[]; assign?: boolean; asg?: 'ASSIGNED' | 'ON_THE_WAY' | 'PICKED_UP' | 'DROPPED_OFF'; extra?: Partial<Spec>; flight?: string }) => {
    const svc = services[o.svc % services.length], veh = vehicles.find((v) => v.vehicleTypeId === svc.vehicleTypeId) ?? vehicles[0];
    const lines = [{ description: svc.name, qty: 1, unit: Number(svc.price) }], t = totalOf(lines, 'TRANSPORT'), at = day(o.at, o.hour);
    return make({ product: 'TRANSPORT', status: o.status, startAt: at, endAt: new Date(at.getTime() + (svc.durationMinutes ?? 60) * 6e4), created: o.created, customer: o.cust, lines, pay: o.pay(t), guests: 1,
      item: async (id) => { await tx.transportBookingItem.create({ data: { supplierId: S, bookingId: id, serviceId: svc.id, vehicleTypeId: svc.vehicleTypeId, originZoneId: svc.originZoneId, destinationZoneId: svc.destinationZoneId, pickupAt: at,
        pickupAddress: svc.originLabel ?? 'Ngurah Rai Airport (DPS)', dropoffAddress: svc.destinationLabel ?? hotel.name, flightNumber: o.flight, passengers: o.pax, luggage: o.pax, amount: Number(svc.price),
        ...(o.assign ? { driverId: veh.driverId, vehicleId: veh.id, assignmentStatus: o.asg ?? 'ASSIGNED', assignedAt: new Date(at.getTime() - 864e5) } : {}),
        ...(o.asg === 'DROPPED_OFF' ? { startedAt: at, completedAt: new Date(at.getTime() + 36e5) } : {}) } }); }, ...o.extra });
  };
  await R({ svc: 0, at: -7, hour: 3, status: 'COMPLETED', created: -14, cust: 1, pax: 2, pay: (t) => [{ amount: t, method: 'CASH' }], assign: true, asg: 'DROPPED_OFF', flight: 'SQ 946' });
  await R({ svc: 1, at: 0, hour: 5, status: 'CONFIRMED', created: -2, cust: 3, pax: 3, pay: (t) => [{ amount: t }], assign: true, asg: 'ON_THE_WAY' });
  await R({ svc: 0, at: 1, hour: 2, status: 'CONFIRMED', created: -1, cust: 4, pax: 2, pay: (t) => [{ amount: t, method: 'CARD' }], flight: 'GA 412', extra: { source: 'WEBSITE' } });
  await R({ svc: 1, at: 3, hour: 1, status: 'PENDING', created: 0, cust: 6, pax: 4, pay: () => [], extra: { hold: true, source: 'PHONE' } });
  await R({ svc: 0, at: 2, hour: 7, status: 'CANCELLED', created: -5, cust: 0, pax: 2, pay: (t) => [{ amount: t, refund: t }], extra: { cancelReason: 'Flight cancelled' } });

  // ---------------- club
  const K = async (o: { club: number; table?: boolean; ev?: number; off: number; guests: number; qty: number; status: BookingStatus; created: number; cust: number; pay: (t: number) => Pay[]; extra?: Partial<Spec>; checkedIn?: number }) => {
    const club = clubs[o.club % clubs.length], tk = tickets.filter((x) => x.clubId === club.id), tb = tables.filter((x) => x.clubId === club.id), ev = events.filter((x) => x.clubId === club.id)[o.ev ?? 0];
    const unit = o.table ? Number(tb[0].minimumSpend) : Number(tk[o.guests > 3 ? 0 : 1 % Math.max(tk.length, 1)].price);
    const lines = [{ description: `${club.name} · ${o.table ? tb[0].name : tk[0].name}`, qty: o.qty, unit }], t = totalOf(lines, 'CLUB');
    return make({ product: 'CLUB', status: o.status, startAt: day(o.off, 13), endAt: day(o.off + 1, 18), created: o.created, customer: o.cust, lines, pay: o.pay(t), guests: o.guests,
      item: async (id) => { await tx.clubBookingItem.create({ data: { supplierId: S, bookingId: id, clubId: club.id, eventId: ev?.id, ticketTypeId: o.table ? null : tk[0].id, tablePackageId: o.table ? tb[0].id : null, visitDate: dateOnly(o.off), arrivalTime: '21:30', guests: o.guests, quantity: o.qty,
        unitPrice: unit, amount: unit * o.qty, tableLabel: o.table ? 'T12' : null, ...(o.checkedIn ? { checkedInAt: day(o.off, 14), checkedInCount: o.checkedIn } : {}) } }); }, ...o.extra });
  };
  await K({ club: 0, off: -8, guests: 4, qty: 4, status: 'COMPLETED', created: -16, cust: 2, pay: (t) => [{ amount: t, method: 'CARD' }], checkedIn: 4 });
  await K({ club: 0, off: 0, guests: 6, qty: 1, table: true, status: 'CONFIRMED', created: -3, cust: 5, pay: (t) => [{ amount: money(t * 0.5) }], extra: { special: 'Birthday cake at 23:00.' } });
  await K({ club: 0, off: 4, guests: 2, qty: 2, status: 'CONFIRMED', created: -1, cust: 7, pay: (t) => [{ amount: t, method: 'QRIS' }], extra: { source: 'WEBSITE' } });
  await K({ club: clubs.length - 1, off: 5, guests: 8, qty: 1, table: true, status: 'PENDING', created: 0, cust: 1, pay: () => [], extra: { hold: true, source: 'PHONE' } });
  await K({ club: 0, off: -2, guests: 3, qty: 3, status: 'EXPIRED', created: -4, cust: 3, pay: () => [], extra: { source: 'WEBSITE' } });
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });

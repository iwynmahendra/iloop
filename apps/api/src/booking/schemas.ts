import { z } from 'zod';
import { dateStr, uuidP } from './util.js';

const money = z.number().min(0).max(1e12);
const text = (n: number) => z.string().trim().max(n);
const optText = (n: number) => text(n).optional().nullable();
const phone = z.string().trim().min(3).max(40);
const email = z.string().trim().toLowerCase().email().max(254);
const country = z.string().trim().toUpperCase().length(2);

export const guestIn = z.object({ fullName: text(150).min(1), guestType: z.enum(['ADULT', 'CHILD', 'INFANT']).default('ADULT'), age: z.number().int().min(0).max(120).optional().nullable(), isLead: z.boolean().default(false), documentNo: optText(60), notes: optText(500) }).strict();

const common = {
  customerId: uuidP.optional(),
  guestName: text(150).min(1).optional(),
  guestEmail: email.optional().nullable(),
  guestPhone: phone.optional().nullable(),
  guestCountryCode: country.optional().nullable(),
  source: z.enum(['ADMIN', 'WEBSITE', 'CONCIERGE', 'PHONE', 'WALK_IN']).default('ADMIN'),
  /** The guest's room. Required for bookings from the guest concierge app. */
  roomNumber: text(20).optional().nullable(),
  specialRequests: optText(2000), internalNotes: optText(2000), externalRef: optText(80),
  guests: z.array(guestIn).max(50).optional(),
  /** Absolute discount in the booking currency. Admins only. */
  discount: z.object({ amount: money, reason: text(200).min(1) }).strict().optional(),
  /** Create as CONFIRMED straight away (for example a paid walk-in). Otherwise PENDING with a hold. */
  confirm: z.boolean().default(false),
};

export const hotelIn = z.object({ ...common, product: z.literal('HOTEL'), roomTypeId: uuidP, ratePlanId: uuidP.optional(), checkIn: dateStr, checkOut: dateStr, rooms: z.number().int().min(1).max(20).default(1), adults: z.number().int().min(1).max(40), children: z.number().int().min(0).max(40).default(0), bedPreference: optText(60) }).strict();
export const tripIn = z.object({ ...common, product: z.literal('TRIP'), scheduleId: uuidP, variantId: uuidP, adults: z.number().int().min(1).max(100), children: z.number().int().min(0).max(100).default(0),
  addons: z.array(z.object({ addonId: uuidP, quantity: z.number().int().min(1).max(100).default(1) }).strict()).max(20).default([]), pickupAddress: optText(500), pickupNotes: optText(500) }).strict();
export const transportIn = z.object({ ...common, product: z.literal('TRANSPORT'), serviceId: uuidP.optional(), route: z.object({ fromZoneId: uuidP, toZoneId: uuidP, vehicleTypeId: uuidP }).strict().optional(),
  pickupAt: z.string().datetime({ offset: true }), pickupAddress: text(500).min(1), dropoffAddress: text(500).min(1), flightNumber: optText(20), passengers: z.number().int().min(1).max(100), luggage: z.number().int().min(0).max(200).default(0),
  returnPickupAt: z.string().datetime({ offset: true }).optional() }).strict()
  .refine((v) => !!v.serviceId !== !!v.route, { message: 'Send either serviceId or route', path: ['serviceId'] });
export const clubIn = z.object({ ...common, product: z.literal('CLUB'), clubId: uuidP, eventId: uuidP.optional(), ticketTypeId: uuidP.optional(), tablePackageId: uuidP.optional(), visitDate: dateStr,
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), guestCount: z.number().int().min(1).max(100), quantity: z.number().int().min(1).max(100).default(1), tableLabel: optText(20) }).strict()
  .refine((v) => !!v.ticketTypeId !== !!v.tablePackageId, { message: 'Choose a ticket type or a table package, not both', path: ['ticketTypeId'] });
export const createBookingIn = z.discriminatedUnion('product', [hotelIn, tripIn, transportIn, clubIn]);
export type CreateBookingIn = z.infer<typeof createBookingIn>;

export const patchBookingIn = z.object({ guestName: text(150).min(1), guestEmail: email.nullable(), guestPhone: phone.nullable(), guestCountryCode: country.nullable(), specialRequests: optText(2000), internalNotes: optText(2000), externalRef: optText(80), guests: z.array(guestIn).max(50) }).partial().strict();
export const statusIn = z.object({ status: z.enum(['CONFIRMED', 'COMPLETED', 'NO_SHOW']), note: optText(500) }).strict();
export const cancelIn = z.object({ reason: text(500).min(3), refundAmount: money.optional() }).strict();
export const noteIn = z.object({ message: text(2000).min(1) }).strict();
export const paymentIn = z.object({ amount: z.number().positive().max(1e12), method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'E_WALLET', 'QRIS', 'ROOM_CHARGE', 'OTHER']), reference: optText(100), paidAt: z.string().datetime({ offset: true }).optional(), notes: optText(500), status: z.enum(['SUCCEEDED', 'PENDING']).default('SUCCEEDED') }).strict();
export const refundIn = z.object({ paymentId: uuidP, amount: z.number().positive().max(1e12), method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'E_WALLET', 'QRIS', 'ROOM_CHARGE', 'OTHER']).optional(), reference: optText(100), notes: optText(500) }).strict();
export const customerIn = z.object({ fullName: text(150).min(1), email: email.nullable().optional(), phone: phone.nullable().optional(), countryCode: country.nullable().optional(), notes: optText(2000) }).strict();
export const customerPatch = customerIn.partial().strict();

export const hotelCheckIn = z.object({ roomNumber: text(20).min(1), itemId: uuidP.optional() }).strict();
export const itemRef = z.object({ itemId: uuidP.optional() }).strict();
export const tripCheckIn = z.object({ participantsShown: z.number().int().min(0).max(200), itemId: uuidP.optional() }).strict();
export const clubCheckIn = z.object({ count: z.number().int().min(1).max(200), tableLabel: optText(20), itemId: uuidP.optional() }).strict();
export const assignIn = z.object({ driverId: uuidP.nullable(), vehicleId: uuidP.nullable().optional(), driverNotes: optText(500), itemId: uuidP.optional() }).strict();
export const dispatchIn = z.object({ status: z.enum(['ON_THE_WAY', 'PICKED_UP', 'DROPPED_OFF']), itemId: uuidP.optional() }).strict();

export const listBookingsQ = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  product: z.enum(['HOTEL', 'TRIP', 'TRANSPORT', 'CLUB']).optional(),
  status: z.string().optional(), // comma list
  paymentStatus: z.string().optional(),
  source: z.enum(['ADMIN', 'WEBSITE', 'OTA', 'CONCIERGE', 'PHONE', 'WALK_IN']).optional(),
  customerId: uuidP.optional(),
  basis: z.enum(['service', 'created']).default('service'),
  from: dateStr.optional(), to: dateStr.optional(),
  deleted: z.enum(['exclude', 'include', 'only']).default('exclude'),
  sort: z.enum(['startAt', 'createdAt', 'totalAmount', 'bookingNo', 'status', 'guestName']).default('startAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

import { z } from 'zod';
import { resources } from './crud/resources.generated.js';
import { schemasFor, filterableFields } from './crud/core.js';

const js = (s: z.ZodType) => z.toJSONSchema(s, { io: 'input', unrepresentable: 'any', target: 'openapi-3.0' } as any);
const env = (data: object) => ({ type: 'object', properties: { success: { type: 'boolean' }, data, message: { type: 'string' }, errors: { nullable: true }, meta: { type: 'object', nullable: true, properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' } } } } });
const json = (schema: object) => ({ content: { 'application/json': { schema } } });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const listParams = (r: (typeof resources)[number]) => [
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
  { name: 'q', in: 'query', description: `Search in: ${r.search.join(', ')}`, schema: { type: 'string' } },
  { name: 'sort', in: 'query', description: 'e.g. name:asc,createdAt:desc', schema: { type: 'string' } },
  { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } },
  { name: 'deleted', in: 'query', schema: { type: 'string', enum: ['exclude', 'include', 'only'], default: 'exclude' } },
  ...filterableFields(r).filter((f) => f.n !== 'status').map((f) => ({ name: f.n, in: 'query', schema: { type: f.t === 'int' ? 'integer' : f.t === 'bool' ? 'boolean' : 'string' } })),
];

export function buildOpenApi() {
  const paths: Record<string, any> = {};
  const schemas: Record<string, any> = {};
  const secured = [{ bearerAuth: [] }];
  const P = '/api/v1';
  const add = (p: string, m: string, op: object) => { (paths[P + p] ??= {})[m] = { security: secured, ...op }; };

  paths[`${P}/auth/login`] = { post: { tags: ['Auth'], summary: 'Login (sets httpOnly refresh cookie, returns access token)', requestBody: { required: true, ...json({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } }) }, responses: { 200: { description: 'OK' }, 401: { description: 'Invalid credentials' }, 423: { description: 'Locked' }, 429: { description: 'Rate limited' } } } };
  paths[`${P}/auth/refresh`] = { post: { tags: ['Auth'], summary: 'Rotate refresh cookie and get a new access token (needs X-CSRF-Token header = csrf_token cookie)', responses: { 200: { description: 'OK' }, 401: { description: 'No valid session' } } } };
  paths[`${P}/auth/logout`] = { post: { tags: ['Auth'], summary: 'Logout (needs X-CSRF-Token)', responses: { 200: { description: 'OK' } } } };
  paths[`${P}/auth/forgot-password`] = { post: { tags: ['Auth'], summary: 'Request a reset link (always 200)', responses: { 200: { description: 'OK' } } } };
  paths[`${P}/auth/reset-password`] = { post: { tags: ['Auth'], summary: 'Reset password with token', responses: { 200: { description: 'OK' } } } };
  add('/auth/me', 'get', { tags: ['Auth'], summary: 'Current user', responses: { 200: { description: 'OK' } } });
  add('/auth/change-password', 'post', { tags: ['Auth'], summary: 'Change own password', responses: { 200: { description: 'OK' } } });
  for (const [p, t, d] of [['/suppliers', 'Suppliers', 'SUPER_ADMIN: manage suppliers. POST /suppliers/{id}/admin creates a supplier admin; /status, /restore, /logo.'], ['/users', 'Users', 'Users of a supplier (SUPER_ADMIN, SUPPLIER_ADMIN).'], ['/audit-logs', 'Audit', 'Who changed what, with before/after JSON.'], ['/dashboard', 'Dashboard', 'Counts, recent changes, supplier overview.']] as const) {
    add(p, 'get', { tags: [t], summary: d, responses: { 200: { description: 'OK' } } });
  }

  for (const r of resources) {
    const base = `/${r.group}/${r.path}`;
    const tag = `${r.group[0]!.toUpperCase()}${r.group.slice(1)} / ${r.name}`;
    const { create, update } = schemasFor(r);
    schemas[`${r.name}Input`] = js(create); schemas[`${r.name}Patch`] = js(update);
    const ref = (n: string) => ({ $ref: `#/components/schemas/${n}` });
    const err = { 401: { description: 'Not authenticated' }, 403: { description: 'Forbidden' }, 404: { description: 'Not found' }, 422: { description: 'Validation failed' } };
    add(base, 'get', { tags: [tag], summary: `List ${r.name}`, parameters: listParams(r), responses: { 200: { description: 'OK', ...json(env({ type: 'array', items: { type: 'object' } })) }, ...err } });
    add(base, 'post', { tags: [tag], summary: `Create ${r.name}`, requestBody: { required: true, ...json(ref(`${r.name}Input`)) }, responses: { 201: { description: 'Created' }, 409: { description: 'Duplicate code' }, ...err } });
    add(`${base}/{id}`, 'get', { tags: [tag], summary: `Get ${r.name}`, parameters: [idParam], responses: { 200: { description: 'OK' }, ...err } });
    add(`${base}/{id}`, 'patch', { tags: [tag], summary: `Update ${r.name} (also PUT)`, parameters: [idParam], requestBody: { required: true, ...json(ref(`${r.name}Patch`)) }, responses: { 200: { description: 'OK' }, ...err } });
    add(`${base}/{id}`, 'delete', { tags: [tag], summary: 'Soft delete (SUPPLIER_ADMIN, SUPER_ADMIN)', parameters: [idParam], responses: { 200: { description: 'OK' }, ...err } });
    add(`${base}/{id}/restore`, 'post', { tags: [tag], summary: 'Restore a soft-deleted record', parameters: [idParam], responses: { 200: { description: 'OK' }, ...err } });
    add(`${base}/{id}/status`, 'patch', { tags: [tag], summary: 'Activate / deactivate', parameters: [idParam], requestBody: { required: true, ...json({ type: 'object', properties: { status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } } }) }, responses: { 200: { description: 'OK' }, ...err } });
    add(`${base}/bulk`, 'post', { tags: [tag], summary: 'Bulk activate / deactivate / delete / restore', requestBody: { required: true, ...json({ type: 'object', properties: { action: { type: 'string', enum: ['activate', 'deactivate', 'delete', 'restore'] }, ids: { type: 'array', items: { type: 'string', format: 'uuid' } } } }) }, responses: { 200: { description: 'OK' }, ...err } });
    add(`${base}/export`, 'get', { tags: [tag], summary: 'Export CSV or XLSX (same filters as list)', parameters: [{ name: 'format', in: 'query', schema: { type: 'string', enum: ['csv', 'xlsx'] } }], responses: { 200: { description: 'File' }, ...err } });
    add(`${base}/import`, 'post', { tags: [tag], summary: 'Import CSV/XLSX (all-or-nothing; ?dryRun=true to validate only)', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 201: { description: 'Imported' }, ...err } });
    for (const s of r.sets) {
      add(`${base}/{id}/${s.path}`, 'get', { tags: [tag], summary: `List ${s.path}`, parameters: [idParam], responses: { 200: { description: 'OK' }, ...err } });
      add(`${base}/{id}/${s.path}`, 'put', { tags: [tag], summary: `Replace ${s.path} (${s.kind === 'join' ? '{ amenityIds: [] }' : '{ items: [{ mediaId, caption?, isCover? }] } in display order'})`, parameters: [idParam], responses: { 200: { description: 'OK' }, ...err } });
    }
  }
  add('/shared/media-assets/upload', 'post', { tags: ['Shared / MediaAsset'], summary: 'Upload up to 10 images (JPEG/PNG/WebP/GIF, size limit from MAX_UPLOAD_MB)', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } }, altText: { type: 'string' }, folder: { type: 'string' } } } } } }, responses: { 201: { description: 'Uploaded' }, 415: { description: 'Unsupported type' } } });

  // ---- Bookings (hand-written: not part of the generated CRUD) ----
  const T = 'Bookings';
  const err = { 401: { description: 'Not authenticated' }, 403: { description: 'Forbidden' }, 404: { description: 'Not found' }, 409: { description: 'Conflict (state, stock or clash)' }, 422: { description: 'Validation failed' } };
  const q = (...n: string[]) => n.map((x) => ({ name: x, in: 'query', schema: { type: 'string' } }));
  const bookingRoutes: [string, string, string, string[]?, string?][] = [
    ['/booking-overview', 'get', 'Dashboard tiles: today, pending holds, unpaid, arrivals, pickups, door counts', ['product']],
    ['/bookings', 'get', 'List bookings (filters: q, product, status, paymentStatus, source, customerId, from, to, basis=service|created, deleted, sort, dir, page, limit)', ['q', 'product', 'status', 'paymentStatus', 'source', 'from', 'to', 'basis', 'sort', 'dir', 'page', 'limit']],
    ['/bookings', 'post', 'Create a booking (priced on the server from master data; hotel, trip, transport or club by "product"). Operator must send X-Supplier-Id', undefined, 'Priced and stock-held. 201; 409 sold out; 422 invalid'],
    ['/bookings/export', 'get', 'Export the filtered list as CSV (max 5000 rows)', ['q', 'product', 'status', 'from', 'to']],
    ['/bookings/calendar', 'get', 'Bookings overlapping a date range, for calendar views', ['from', 'to', 'product']],
    ['/bookings/{id}', 'get', 'Booking detail: customer, lines, guests, items, payments, timeline, policy, balance'],
    ['/bookings/{id}', 'patch', 'Edit guest details, notes and the named guest list of a PENDING or CONFIRMED booking'],
    ['/bookings/{id}', 'delete', 'Soft delete a cancelled, expired, completed or no-show booking (admins)'],
    ['/bookings/{id}/restore', 'post', 'Restore a soft-deleted booking (admins)'],
    ['/bookings/{id}/status', 'post', 'Confirm, complete or mark no-show { status, note? }'],
    ['/bookings/{id}/cancel-preview', 'get', 'Refund the cancellation policy would give right now'],
    ['/bookings/{id}/cancel', 'post', 'Cancel { reason, refundAmount? }: applies policy, refunds, releases stock. Staff: unpaid PENDING only'],
    ['/bookings/{id}/notes', 'post', 'Add a note to the timeline'],
    ['/bookings/{id}/payments', 'post', 'Record a payment { amount, method, reference?, paidAt?, status? }'],
    ['/bookings/{id}/refunds', 'post', 'Refund against a payment { paymentId, amount } (admins)'],
    ['/bookings/{id}/check-in', 'post', 'Hotel { roomNumber }, trip { participantsShown } or club { count, tableLabel? } check-in'],
    ['/bookings/{id}/check-out', 'post', 'Hotel check-out (completes the booking)'],
    ['/bookings/{id}/assign', 'post', 'Transport: assign driver and vehicle (checks clashes, licence and insurance)'],
    ['/bookings/{id}/dispatch', 'post', 'Transport: ON_THE_WAY, PICKED_UP, DROPPED_OFF'],
    ['/bookings/{id}/emails', 'get', 'The emails sent for a booking (guest and supplier) and whether they went out'],
    ['/bookings/{id}/emails/{emailId}/resend', 'post', 'Send a failed or skipped booking email again, optionally to a corrected address'],
    ['/bookings/expire-holds', 'post', 'Expire overdue pending bookings now (operator only; the sweeper does this every minute)'],
    ['/payments', 'get', 'Payments and refunds ledger', ['kind', 'method', 'txStatus', 'product', 'from', 'to', 'page', 'limit']],
    ['/payments/{id}/void', 'post', 'Void a payment or refund (admins)'],
    ['/customers', 'get', 'Customers of the supplier', ['q', 'page', 'limit']],
    ['/customers', 'post', 'Create a customer'],
    ['/customers/{id}', 'get', 'Customer with booking history and lifetime spend'],
    ['/customers/{id}', 'patch', 'Update a customer'],
    ['/customers/{id}', 'delete', 'Soft delete a customer (admins)'],
    ['/availability/hotel', 'get', 'Rooms and rates for a stay', ['hotelId', 'checkIn', 'checkOut', 'rooms']],
    ['/availability/trips', 'get', 'Departures with remaining quota', ['tripId', 'from', 'to', 'pax']],
    ['/availability/transport', 'get', 'Free drivers and vehicles around a pickup time', ['vehicleTypeId', 'pickupAt']],
    ['/availability/club', 'get', 'Tickets and tables left on a date', ['clubId', 'date']],
    ['/boards/hotel', 'get', 'Arrivals, departures, in-house and occupancy for a day', ['date', 'hotelId']],
    ['/boards/trips', 'get', 'Departures with manifests', ['from', 'to', 'tripId']],
    ['/boards/transport', 'get', 'Dispatch board: jobs, drivers, vehicles', ['date', 'days']],
    ['/boards/club', 'get', 'Door list and totals for a night', ['date', 'clubId']],
    ['/reports/summary', 'get', 'Revenue and volume by period, product, status, source (admins)', ['from', 'to', 'product', 'groupBy']],
    ['/reports/commission', 'get', 'Commission per supplier and product (admins; operator sees all suppliers)', ['from', 'to', 'product']],
    ['/reports/payments', 'get', 'Money in, refunds and net by method (admins)', ['from', 'to']],
  ];
  for (const [p, m, summary, params] of bookingRoutes) {
    const hasId = p.includes('{id}');
    add(p, m, { tags: [T], summary, parameters: [...(hasId ? [idParam] : []), ...q(...(params ?? []))], ...(m === 'post' || m === 'patch' ? { requestBody: { required: false, ...json({ type: 'object' }) } } : {}), responses: { 200: { description: 'OK' }, ...(m === 'post' ? { 201: { description: 'Created' } } : {}), ...err } });
  }

  return {
    openapi: '3.0.3',
    info: { title: 'Booking Admin API', version: '1.0.0', description: 'Master data admin API. Response envelope: { success, data, message, errors, meta: { page, limit, total } }. Supplier isolation: taken from the JWT; SUPER_ADMIN may send X-Supplier-Id.' },
    servers: [{ url: '/' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas },
    paths,
  };
}

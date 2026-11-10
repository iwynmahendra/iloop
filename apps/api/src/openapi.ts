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

  // ---- Integrations, Ops board and Guest concierge (hand-written) ----
  const tagged: [string, string, string, string, string[]?][] = [
    ['Integrations', '/integrations', 'get', 'PMS and channel connections of the supplier', []],
    ['Integrations', '/integrations', 'post', 'Add a connection { provider, name, config } (admins)', []],
    ['Integrations', '/integrations/{id}', 'patch', 'Update or pause a connection (admins)', []],
    ['Integrations', '/integrations/{id}', 'delete', 'Remove a connection (admins)', []],
    ['Integrations', '/integrations/{id}/test', 'post', 'Test the connection', []],
    ['Integrations', '/integrations/{id}/sync', 'post', 'Pull reservations and room states now', []],
    ['Integrations', '/integration-events', 'get', 'Outbox and inbound event log', ['topic', 'status', 'page', 'limit']],
    ['Integrations', '/integration-events/{id}/retry', 'post', 'Retry a failed event', []],
    ['Integrations', '/integration-events/run', 'post', 'Run the delivery worker now', []],
    ['Integrations', '/api-keys', 'get', 'API keys (prefix only; secrets are never shown again)', []],
    ['Integrations', '/api-keys', 'post', 'Create an API key { name, scopes }. The full key is returned once', []],
    ['Integrations', '/api-keys/{id}', 'delete', 'Revoke an API key', []],
    ['Integrations', '/webhooks', 'get', 'Outbound webhook subscriptions', []],
    ['Integrations', '/webhooks', 'post', 'Add a webhook { url, topics }', []],
    ['Integrations', '/webhooks/{id}', 'patch', 'Update a webhook', []],
    ['Integrations', '/webhooks/{id}', 'delete', 'Delete a webhook', []],
    ['Integrations', '/webhooks/{id}/test', 'post', 'Send a test event', []],
    ['Integrations', '/webhooks/{id}/secret', 'get', 'Signing secret (admins)', []],
    ['Integrations', '/pms/reservations', 'get', 'Mirror of reservations read from the PMS', ['page', 'limit']],
    ['Integrations', '/pms/rooms', 'get', 'Mirror of room states read from the PMS', []],
    ['Ops board', '/ops/overview', 'get', 'Counts, rooms by status, workload and alerts (request past target, task overdue or blocked, order waiting)', []],
    ['Ops board', '/ops/tasks', 'get', 'Tasks and guest requests', ['kind', 'status', 'department', 'assigneeId', 'q', 'open', 'page', 'limit']],
    ['Ops board', '/ops/tasks', 'post', 'Create a task { title, department, priority, assigneeId?, roomNumber?, notes? }', []],
    ['Ops board', '/ops/tasks/{id}', 'patch', 'Change status, assignee, priority, notes, due time or department (writes the history)', []],
    ['Ops board', '/ops/tasks/{id}/notes', 'post', 'Add a note { message }', []],
    ['Ops board', '/ops/tasks/{id}', 'delete', 'Delete a task (admins)', []],
    ['Ops board', '/ops/staff', 'get', 'Ops staff and duty status', []],
    ['Ops board', '/ops/staff', 'post', 'Add staff (admins)', []],
    ['Ops board', '/ops/staff/{id}', 'patch', 'Update staff; any user may toggle onDuty', []],
    ['Ops board', '/ops/staff/{id}', 'delete', 'Remove staff (admins)', []],
    ['Ops board', '/ops/rooms', 'get', 'Rooms with housekeeping status and Do Not Disturb', []],
    ['Ops board', '/ops/rooms', 'post', 'Add one room or { rooms: [...] } (admins; existing numbers are skipped)', []],
    ['Ops board', '/ops/rooms/{id}', 'patch', 'Change status, dnd or notes', []],
    ['Ops board', '/ops/rooms/{id}', 'delete', 'Delete a room (admins)', []],
    ['Ops board', '/ops/dining/items', 'get', 'Room dining menu', []],
    ['Ops board', '/ops/dining/items', 'post', 'Add a menu item (admins)', []],
    ['Ops board', '/ops/dining/items/{id}', 'patch', 'Edit an item (admins); staff may only toggle available', []],
    ['Ops board', '/ops/dining/items/{id}', 'delete', 'Delete an item (admins)', []],
    ['Ops board', '/ops/dining/orders', 'get', 'Room dining orders', ['status', 'open', 'page', 'limit']],
    ['Ops board', '/ops/dining/orders/{id}', 'patch', 'Move an order: PREPARING, ON_THE_WAY, DELIVERED or CANCELLED', []],
    ['Ops board', '/ops/kb', 'get', 'Knowledge base documents the guest assistant answers from', []],
    ['Ops board', '/ops/kb', 'post', 'Add a document (admins)', []],
    ['Ops board', '/ops/kb/{id}', 'patch', 'Edit or hide a document (admins)', []],
    ['Ops board', '/ops/kb/{id}', 'delete', 'Delete a document (admins)', []],
    ['Ops board', '/ops/notes', 'get', 'Shift handover notes', []],
    ['Ops board', '/ops/notes', 'post', 'Add a shift note { body }', []],
  ];
  for (const [tag, p, m, summary, params] of tagged) {
    add(p, m, { tags: [tag], summary, parameters: [...(p.includes('{id}') ? [idParam] : []), ...q(...(params ?? []))], ...(m === 'post' || m === 'patch' ? { requestBody: { required: false, ...json({ type: 'object' }) } } : {}), responses: { 200: { description: 'OK' }, ...err } });
  }
  paths[`${P}/integrations/inbound/{id}`] = { post: { tags: ['Integrations'], summary: 'Inbound webhook from a PMS or channel. Public; authenticated by the HMAC signature header', parameters: [idParam], requestBody: { required: true, ...json({ type: 'object' }) }, responses: { 200: { description: 'Accepted' }, 401: { description: 'Bad signature' } } } };

  // Guest app: a separate token (issuer booking-admin, audience booking-admin-guest) obtained from /guest/auth
  const guestSec = [{ guestAuth: [] }];
  const G = 'Guest concierge';
  paths[`${P}/guest/auth`] = { post: { tags: [G], summary: 'Sign in with { bookingNo, lastName }. The booking must be CONFIRMED, from the day before check-in until check-out. Rate limited', requestBody: { required: true, ...json({ type: 'object', required: ['bookingNo', 'lastName'], properties: { bookingNo: { type: 'string' }, lastName: { type: 'string' } } }) }, responses: { 200: { description: 'OK: { token, name, room }' }, 401: { description: 'No current stay found' }, 429: { description: 'Too many attempts' } } } };
  const guestRoutes: [string, string, string][] = [
    ['/guest/me', 'get', 'The guest stay: room, dates, hotel details, balance, Do Not Disturb'],
    ['/guest/services', 'get', 'Services the guest can request, with their questions and progress steps'],
    ['/guest/menu', 'get', 'Available room dining items'],
    ['/guest/dnd', 'patch', 'Set Do Not Disturb { dnd } (needs a room)'],
    ['/guest/requests', 'get', 'The guest requests with the current progress step'],
    ['/guest/requests', 'post', 'Create a request { service, answers, note?, urgent? }. Needs a room; creates an ops task and emits request.created'],
    ['/guest/orders', 'get', 'The guest dining orders'],
    ['/guest/orders', 'post', 'Order { items: [{ id, qty }], note?, when }. Prices come from the menu on the server'],
    ['/guest/bookings', 'get', 'Other bookings of the same guest'],
    ['/guest/kb', 'get', 'Search the knowledge base (?q=)'],
    ['/guest/assistant', 'post', 'Ask { message, history? }. With ANTHROPIC_API_KEY the model answers in the guest language (mode "ai"); otherwise keyword search (mode "search"). 20 per minute'],
  ];
  for (const [p, m, summary] of guestRoutes) {
    paths[P + p] ??= {};
    paths[P + p][m] = { tags: [G], security: guestSec, summary, ...(p === '/guest/kb' ? { parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }] } : {}), ...(m === 'post' || m === 'patch' ? { requestBody: { required: true, ...json({ type: 'object' }) } } : {}), responses: { 200: { description: 'OK' }, 201: { description: 'Created' }, 401: { description: 'Sign in again' }, 409: { description: 'Needs a room, or too many open requests' }, 422: { description: 'Validation failed' } } };
  }

  return {
    openapi: '3.0.3',
    info: { title: 'Booking Admin API', version: '1.0.0', description: 'Master data admin API. Response envelope: { success, data, message, errors, meta: { page, limit, total } }. Supplier isolation: taken from the JWT; SUPER_ADMIN may send X-Supplier-Id.' },
    servers: [{ url: '/' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, guestAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Guest token from POST /guest/auth. Only valid on /guest/*' } }, schemas },
    paths,
  };
}

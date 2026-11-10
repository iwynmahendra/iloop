# Integration review and architecture

Goal: every app (five admin consoles, Ops Board, Guest Concierge) works through one API, and a third-party property management system (PMS: OPERA Cloud, VHP, others) can be connected per hotel without changing any app.

## 1. Review of the current artifacts

All seven are previews. Each keeps its own data in the browser, so none of them can see another's changes yet. That is fine for design review, but it is the main gap to close.

| Artifact | What it does today | Integration gap | Adjustment |
|---|---|---|---|
| Hotel admin | Bookings, front desk, availability, inventory, channel manager, booking engine | Channel and widget links are simulated. Stock, rates and rules are in browser memory. No single place for connections | New **Integrations** page (connections, API keys, webhooks, event log). Stock and rates stay owned by the platform and are pushed out |
| Trips, Transport, Club admin | Bookings and dispatch/door lists | Charge to room is only a field. No guest lookup | `pms.post_charge` event when a booking is charged to a room (see 4) |
| Operator console | Tenants, commission, audit | No view of connection health across tenants | Integration health table: status and failed events per tenant |
| Ops Board | Tasks, rooms, front desk, PMS master data, dining | PMS settings and arrivals/in-house data are demo data | Read from `pms_reservation` and `pms_room_state`. Check in, check out and housekeeping status write back through the outbox |
| Guest Concierge | Stay sign-in, requests, dining, bookings, AI chat | Verifies the stay against local sample data. AI runs in the page | Stay lookup through `lookupReservation`. Requests become tasks. AI and translation move to the server with the hotel knowledge base |
| API | Bookings, outbox for email, RLS | No integration layer | Section 3 (built in this step) |

Cross-cutting findings that drive the design:
1. **One contract.** Apps must call only `/api/v1`. No app talks to a PMS, channel or payment provider directly.
2. **Source of truth must be explicit** per data type (section 2). Without it two systems overwrite each other.
3. **Delivery must be safe to repeat.** PMS and channel calls fail. Every outgoing call goes through an outbox with an idempotency key, retry and a dead letter state, the same pattern as `email_outbox`.
4. **IDs differ across systems.** An `external_ref` table maps our id to the PMS id, per connection.
5. **Secrets stay on the server.** Tables hold a `secret_ref` (an environment variable name), never a password. Webhook secrets are derived, not stored.
6. **Tenant isolation.** Every new table has `supplier_id` and row level security like the rest.

## 2. Source of truth

| Data | Owner when a PMS is connected | Owner without a PMS | Direction |
|---|---|---|---|
| Reservation (room stay) | PMS | Platform (`bookings`) | PMS to platform (mirror). Platform bookings from the website or channels are pushed to the PMS |
| In-house state, room number, check-in/out times | PMS | Platform | PMS to platform. Ops Board actions write back |
| Room front office status | PMS | Platform | PMS to platform |
| Housekeeping status | Shared. Last change wins, newest timestamp | Platform | Both ways |
| Folio charges | PMS | Platform payments | Platform to PMS (`post_charge`) |
| Rates and restrictions | Per hotel setting `ratesMaster`: PMS or PLATFORM | Platform | Chosen master pushes to channels and the booking engine |
| Availability | Platform counts live bookings plus PMS holds | Platform | Platform to channels and booking engine |
| Trips, transport, club bookings | Platform | Platform | Charge to room only |

## 3. Integration layer (in the API)

```
 Apps (admin, Ops, Guest)  ──►  /api/v1  ──►  domain services
                                                  │ emit(topic, payload)
                                                  ▼
 integration_event (OUT)  ──►  worker  ──►  adapters (PMS, channel, payment, mail) and signed webhooks
 inbound webhook / polling ──►  integration_event (IN) ──►  processor ──►  pms_reservation, pms_room_state, bookings
```

Tables (migration `20260103000000_integrations`, all with RLS):
- `integration_connection`: kind (PMS, CHANNEL, PAYMENT, EMAIL, AI), provider, status, non-secret `config`, `secret_ref`, last ok, last error.
- `external_ref`: our entity to the provider's id, unique both ways per connection.
- `integration_event`: IN and OUT events with `idempotency_key` (unique), status PENDING, DONE, FAILED, DEAD, SKIPPED, attempts, next attempt, last error.
- `api_key`: scoped keys for third parties and the widget. Only a SHA-256 hash and a short prefix are stored.
- `webhook_endpoint`: URL, topics, active. Each delivery is signed `X-Signature: t=<unix>,v1=<hex>` where `v1 = HMAC_SHA256(secret, t + "." + body)`. The secret is `HMAC(WEBHOOK_MASTER_KEY, endpointId)`, shown once on create.
- `pms_reservation`, `pms_room_state`: the mirror that Front desk and Rooms read.

Endpoints (admin role, supplier scoped):
`GET/POST /integrations`, `PATCH/DELETE /integrations/:id`, `POST /integrations/:id/test`, `POST /integrations/:id/sync`, `GET /integration-events`, `POST /integration-events/:id/retry`, `GET/POST/DELETE /api-keys`, `GET/POST/PATCH/DELETE /webhooks`, `POST /webhooks/:id/test`, `GET /pms/reservations`, `GET /pms/rooms`.
Public: `POST /integrations/inbound/:connectionId` (HMAC signed by the provider or its middleware, idempotent).

Event topics: `booking.created`, `booking.status_changed`, `stay.checked_in`, `stay.checked_out`, `room.status_changed`, `charge.posted`, `request.created`, `inventory.changed`, `rate.changed`, `payment.succeeded`, and the PMS commands `pms.post_charge`, `pms.push_booking`, `pms.check_in`, `pms.check_out`, `pms.room_status`.

Retry: wait `30 s x 2^attempts`, give up (DEAD) after 6. DEAD events show in the Integrations page and can be retried by an admin. A nightly reconciliation job compares the PMS reservation list with the mirror.

## 4. PMS adapter contract

```ts
interface PmsAdapter {
  id: 'opera-cloud' | 'vhp' | 'mock' | 'none';
  capabilities: { pullReservations: boolean; roomStatus: boolean; checkInOut: boolean; postCharge: boolean; pushBooking: boolean; webhook: boolean };
  testConnection(c): Promise<{ ok: boolean; message: string }>;
  pullReservations(c, { from, to, cursor? }): Promise<{ items: PmsReservation[]; cursor?: string }>;
  pullRoomStatus(c): Promise<PmsRoomState[]>;
  checkIn(c, ref, roomNo): Promise<void>;
  checkOut(c, ref): Promise<void>;
  setHousekeeping(c, roomNo, status): Promise<void>;
  postCharge(c, { ref, code, amount, description, idempotencyKey }): Promise<{ externalId: string }>;
  pushBooking(c, booking): Promise<{ externalId: string }>;
}
```
Delivered adapters: `mock` (deterministic sample hotel, used for tests and sandbox), `none`, and `opera-cloud` and `vhp` as typed stubs that report "credentials and certification needed" from `testConnection`. They are stubs on purpose: real calls need the hotel's OHIP subscription (OPERA Cloud) or the VHP vendor's API, which this project does not have. Endpoint names in the stubs are the planned mapping and must be confirmed against that documentation.

Charge to room: when a booking with a room number is created, an event `pms.post_charge` is queued for each connected PMS that has `postCharge` and `config.postCharges = true`. The idempotency key is `charge:<bookingId>`, so a retry never double posts.

## 5. Security
- API keys: shown once, stored hashed, scoped (`bookings:read`, `availability:read`, `bookings:write`), revocable.
- Webhooks out and in are signed. Inbound uses the same scheme, rejects a timestamp older than 5 minutes, and stores the idempotency key so a replay does nothing.
- `config` JSON is validated per provider and never holds secrets. An unknown key is rejected.
- Guest data sent to a third party is limited to what the call needs. Guest sign-in codes and Wi-Fi passwords are never sent.

## 6. Roll-out per hotel
1. Create a connection (provider, config), set its secret in the server environment, press Test.
2. Run a sync. Check the mirror in Front desk and Rooms.
3. Turn on write-back (check in/out, housekeeping) and charge posting, one at a time.
4. Watch the event log for a week, then enable the nightly reconciliation.

## 7. Still needed from outside
- OPERA Cloud: OHIP developer access, the hotel's chain and hotel codes, and an app key. VHP: the vendor's API spec and a test property.
- A real mail provider and payment provider for the live app.
- Real channel connections (Booking.com, Expedia, Agoda) need each partner programme or a channel manager aggregator.

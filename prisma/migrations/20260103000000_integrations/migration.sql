-- Integration layer: connections to third parties (PMS, channels, payments), id mapping, a two-way event outbox,
-- scoped API keys, signed webhooks, and the mirror of the PMS (reservations, room state) that Front desk and Rooms read.
-- Secrets never live here: a connection keeps only the NAME of a server environment variable (secret_ref).
CREATE TYPE "IntegrationKind" AS ENUM ('PMS', 'CHANNEL', 'PAYMENT', 'EMAIL', 'AI');
CREATE TYPE "IntegrationStatus" AS ENUM ('DISABLED', 'PENDING', 'CONNECTED', 'ERROR');
CREATE TYPE "EventDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "IntegrationEventStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'DEAD', 'SKIPPED');
CREATE TYPE "PmsStayStatus" AS ENUM ('RESERVED', 'IN_HOUSE', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

CREATE TABLE "integration_connection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secret_ref" VARCHAR(80),
    "last_ok_at" TIMESTAMPTZ(6),
    "last_sync_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_connection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "integration_connection_secret_ref_check" CHECK (secret_ref IS NULL OR secret_ref ~ '^[A-Z][A-Z0-9_]{2,79}$')
);
CREATE UNIQUE INDEX "integration_connection_supplier_id_kind_provider_key" ON "integration_connection"("supplier_id", "kind", "provider");
CREATE UNIQUE INDEX "integration_connection_supplier_id_id_key" ON "integration_connection"("supplier_id", "id");
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "webhook_endpoint" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "description" VARCHAR(120),
    "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_endpoint_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "webhook_endpoint_url_check" CHECK (url ~ '^https://')
);
CREATE UNIQUE INDEX "webhook_endpoint_supplier_id_id_key" ON "webhook_endpoint"("supplier_id", "id");
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "external_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" UUID NOT NULL,
    "external_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_ref_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_ref_connection_id_entity_type_external_id_key" ON "external_ref"("connection_id", "entity_type", "external_id");
CREATE UNIQUE INDEX "external_ref_connection_id_entity_type_entity_id_key" ON "external_ref"("connection_id", "entity_type", "entity_id");
ALTER TABLE "external_ref" ADD CONSTRAINT "external_ref_supplier_id_connection_id_fkey" FOREIGN KEY ("supplier_id", "connection_id") REFERENCES "integration_connection"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "integration_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "connection_id" UUID,
    "webhook_id" UUID,
    "direction" "EventDirection" NOT NULL,
    "topic" VARCHAR(60) NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "done_at" TIMESTAMPTZ(6),
    CONSTRAINT "integration_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "integration_event_target_check" CHECK (num_nonnulls(connection_id, webhook_id) = 1),
    CONSTRAINT "integration_event_attempts_check" CHECK (attempts >= 0),
    CONSTRAINT "integration_event_done_check" CHECK (status NOT IN ('DONE') OR done_at IS NOT NULL)
);
CREATE UNIQUE INDEX "integration_event_idempotency_key" ON "integration_event"("supplier_id", "direction", "idempotency_key");
CREATE INDEX "integration_event_status_next_attempt_at_idx" ON "integration_event"("status", "next_attempt_at");
CREATE INDEX "integration_event_supplier_id_created_at_idx" ON "integration_event"("supplier_id", "created_at");
ALTER TABLE "integration_event" ADD CONSTRAINT "integration_event_supplier_id_connection_id_fkey" FOREIGN KEY ("supplier_id", "connection_id") REFERENCES "integration_connection"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_event" ADD CONSTRAINT "integration_event_supplier_id_webhook_id_fkey" FOREIGN KEY ("supplier_id", "webhook_id") REFERENCES "webhook_endpoint"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "api_key" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "prefix" VARCHAR(12) NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "api_key_prefix_key" ON "api_key"("prefix");
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "pms_reservation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "external_id" VARCHAR(100) NOT NULL,
    "confirmation_no" VARCHAR(40),
    "guest_name" VARCHAR(160) NOT NULL,
    "guest_email" VARCHAR(254),
    "guest_phone" VARCHAR(40),
    "room_type" VARCHAR(80),
    "room_no" VARCHAR(20),
    "arrival" DATE NOT NULL,
    "departure" DATE NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "status" "PmsStayStatus" NOT NULL DEFAULT 'RESERVED',
    "rate_code" VARCHAR(40),
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pms_reservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pms_reservation_dates_check" CHECK (departure > arrival)
);
CREATE UNIQUE INDEX "pms_reservation_connection_id_external_id_key" ON "pms_reservation"("connection_id", "external_id");
CREATE INDEX "pms_reservation_supplier_id_arrival_idx" ON "pms_reservation"("supplier_id", "arrival");
CREATE INDEX "pms_reservation_supplier_id_departure_idx" ON "pms_reservation"("supplier_id", "departure");
ALTER TABLE "pms_reservation" ADD CONSTRAINT "pms_reservation_supplier_id_connection_id_fkey" FOREIGN KEY ("supplier_id", "connection_id") REFERENCES "integration_connection"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pms_room_state" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "room_no" VARCHAR(20) NOT NULL,
    "fo_status" VARCHAR(20) NOT NULL DEFAULT 'VACANT',
    "hk_status" VARCHAR(20) NOT NULL DEFAULT 'CLEAN',
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pms_room_state_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pms_room_state_connection_id_room_no_key" ON "pms_room_state"("connection_id", "room_no");
ALTER TABLE "pms_room_state" ADD CONSTRAINT "pms_room_state_supplier_id_connection_id_fkey" FOREIGN KEY ("supplier_id", "connection_id") REFERENCES "integration_connection"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_connection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_connection" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "integration_connection" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "integration_connection" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "integration_connection" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
ALTER TABLE "webhook_endpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_endpoint" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "webhook_endpoint" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "webhook_endpoint" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "webhook_endpoint" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
ALTER TABLE "external_ref" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_ref" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "external_ref" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "external_ref" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "external_ref" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
ALTER TABLE "integration_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_event" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "integration_event" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "integration_event" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "integration_event" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
ALTER TABLE "api_key" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_key" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "api_key" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "api_key" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "api_key" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
ALTER TABLE "pms_reservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pms_reservation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "pms_reservation" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "pms_reservation" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "pms_reservation" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
ALTER TABLE "pms_room_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pms_room_state" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "pms_room_state" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "pms_room_state" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "pms_room_state" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
-- delete is allowed only where rows are configuration (connections, webhooks, keys); events and the PMS mirror are history
CREATE POLICY tenant_delete ON "integration_connection" FOR DELETE USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "webhook_endpoint" FOR DELETE USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "api_key" FOR DELETE USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "external_ref" FOR DELETE USING (app_is_super() OR supplier_id = app_supplier_id());

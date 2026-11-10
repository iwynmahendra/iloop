-- Booking emails. A row is written in the same transaction as the booking (so a booking never loses its emails);
-- a sender picks up QUEUED rows and delivers them. One row per recipient: the guest and the supplier.
CREATE TYPE "EmailRecipientKind" AS ENUM ('GUEST', 'SUPPLIER');
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "template" VARCHAR(40) NOT NULL,
    "recipient_kind" "EmailRecipientKind" NOT NULL,
    "to_email" VARCHAR(254),
    "subject" VARCHAR(200) NOT NULL,
    "body_text" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),
    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_outbox_attempts_check" CHECK (attempts >= 0),
    CONSTRAINT "email_outbox_sent_check" CHECK (status <> 'SENT' OR sent_at IS NOT NULL)
);
CREATE INDEX "email_outbox_status_created_at_idx" ON "email_outbox"("status", "created_at");
CREATE INDEX "email_outbox_supplier_id_booking_id_idx" ON "email_outbox"("supplier_id", "booking_id");
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_supplier_id_booking_id_fkey" FOREIGN KEY ("supplier_id", "booking_id") REFERENCES "bookings"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_outbox" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "email_outbox" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "email_outbox" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "email_outbox" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
-- no delete policy: sent mail is history

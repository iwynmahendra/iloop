-- Hotel operations (Ops Board) and the guest app: staff, rooms, tasks and guest requests, room dining, knowledge base, shift notes.
-- Every table is tenant-scoped (supplier_id) with row level security, like the rest of the schema.

CREATE TABLE "ops_staff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "department" VARCHAR(30) NOT NULL,
    "on_duty" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ops_staff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ops_staff_supplier_id_id_key" ON "ops_staff"("supplier_id", "id");
ALTER TABLE "ops_staff" ADD CONSTRAINT "ops_staff_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ops_room" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "room_number" VARCHAR(20) NOT NULL,
    "floor" VARCHAR(10),
    "status" VARCHAR(20) NOT NULL DEFAULT 'CLEAN',
    "dnd" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(300),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ops_room_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ops_room_status_check" CHECK (status IN ('DIRTY','CLEANING','CLEAN','INSPECTED','OUT_OF_ORDER'))
);
CREATE UNIQUE INDEX "ops_room_supplier_id_room_number_key" ON "ops_room"("supplier_id", "room_number");
ALTER TABLE "ops_room" ADD CONSTRAINT "ops_room_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ops_task" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "kind" VARCHAR(10) NOT NULL DEFAULT 'TASK',
    "ref" VARCHAR(20),
    "title" VARCHAR(200) NOT NULL,
    "department" VARCHAR(30) NOT NULL,
    "priority" VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    "status" VARCHAR(12) NOT NULL DEFAULT 'TODO',
    "assignee_id" UUID,
    "room_number" VARCHAR(20),
    "guest_name" VARCHAR(150),
    "request_type" VARCHAR(60),
    "details" JSONB NOT NULL DEFAULT '{}',
    "notes" VARCHAR(1000),
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "booking_id" UUID,
    "source" VARCHAR(20) NOT NULL DEFAULT 'STAFF',
    "due_at" TIMESTAMPTZ(6),
    "done_at" TIMESTAMPTZ(6),
    "log" JSONB NOT NULL DEFAULT '[]',
    "created_by" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ops_task_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ops_task_kind_check" CHECK (kind IN ('TASK','REQUEST')),
    CONSTRAINT "ops_task_priority_check" CHECK (priority IN ('NORMAL','URGENT')),
    CONSTRAINT "ops_task_status_check" CHECK (status IN ('TODO','IN_PROGRESS','BLOCKED','DONE'))
);
CREATE UNIQUE INDEX "ops_task_supplier_id_id_key" ON "ops_task"("supplier_id", "id");
CREATE UNIQUE INDEX "ops_task_supplier_id_ref_key" ON "ops_task"("supplier_id", "ref");
CREATE INDEX "ops_task_supplier_id_status_idx" ON "ops_task"("supplier_id", "status");
CREATE INDEX "ops_task_supplier_id_booking_id_idx" ON "ops_task"("supplier_id", "booking_id");
ALTER TABLE "ops_task" ADD CONSTRAINT "ops_task_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_task" ADD CONSTRAINT "ops_task_supplier_id_assignee_id_fkey" FOREIGN KEY ("supplier_id", "assignee_id") REFERENCES "ops_staff"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "dining_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(300),
    "price" DECIMAL(14,2) NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dining_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dining_item_price_check" CHECK (price >= 0)
);
CREATE UNIQUE INDEX "dining_item_supplier_id_id_key" ON "dining_item"("supplier_id", "id");
ALTER TABLE "dining_item" ADD CONSTRAINT "dining_item_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "dining_order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "ref" VARCHAR(20) NOT NULL,
    "booking_id" UUID,
    "room_number" VARCHAR(20) NOT NULL,
    "guest_name" VARCHAR(150),
    "items" JSONB NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'IDR',
    "note" VARCHAR(500),
    "deliver_when" VARCHAR(30) NOT NULL DEFAULT 'ASAP',
    "status" VARCHAR(12) NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dining_order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dining_order_status_check" CHECK (status IN ('NEW','PREPARING','ON_THE_WAY','DELIVERED','CANCELLED'))
);
CREATE UNIQUE INDEX "dining_order_supplier_id_ref_key" ON "dining_order"("supplier_id", "ref");
CREATE INDEX "dining_order_supplier_id_status_idx" ON "dining_order"("supplier_id", "status");
ALTER TABLE "dining_order" ADD CONSTRAINT "dining_order_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "kb_doc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "category" VARCHAR(40) NOT NULL DEFAULT 'General',
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kb_doc_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_doc_supplier_id_id_key" ON "kb_doc"("supplier_id", "id");
ALTER TABLE "kb_doc" ADD CONSTRAINT "kb_doc_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "shift_note" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "author" VARCHAR(80) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_note_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "shift_note_supplier_id_created_at_idx" ON "shift_note"("supplier_id", "created_at");
ALTER TABLE "shift_note" ADD CONSTRAINT "shift_note_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- row level security
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ops_staff','ops_room','ops_task','dining_item','dining_order','kb_doc','shift_note'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_select ON %I FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id())', t);
    EXECUTE format('CREATE POLICY tenant_insert ON %I FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id())', t);
    EXECUTE format('CREATE POLICY tenant_update ON %I FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id())', t);
    EXECUTE format('CREATE POLICY tenant_delete ON %I FOR DELETE USING (app_is_super() OR supplier_id = app_supplier_id())', t);
  END LOOP;
END $$;

-- Guest sign-in happens before any tenant is known. This one narrow function is the only way in: it returns a single
-- in-stay HOTEL booking when the booking number and part of the guest's name match, and nothing else.
CREATE FUNCTION guest_find_stay(p_booking_no text, p_last_name text)
RETURNS TABLE (booking_id uuid, supplier_id uuid, guest_name text, room_number text, hotel_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.supplier_id, b.guest_name::text, COALESCE(i.room_number, b.room_number)::text, i.hotel_id
  FROM bookings b JOIN hotel_booking_items i ON i.booking_id = b.id AND i.supplier_id = b.supplier_id
  WHERE b.product = 'HOTEL' AND b.deleted_at IS NULL AND b.status = 'CONFIRMED'
    AND upper(b.booking_no) = upper(trim(p_booking_no)) AND length(trim(p_last_name)) >= 2
    AND position(lower(trim(p_last_name)) in lower(b.guest_name)) > 0
    AND i.check_out >= CURRENT_DATE AND i.check_in <= CURRENT_DATE + 1
  ORDER BY i.check_in LIMIT 1
$$;
REVOKE ALL ON FUNCTION guest_find_stay(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION guest_find_stay(text, text) TO app_runtime;

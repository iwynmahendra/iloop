-- Row level security for the booking tables. Same rules as the master data: SUPER_ADMIN sees everything, other roles only their own supplier.
-- Extra rules: bookings and payments are never hard deleted by staff; refunds need an admin; the timeline is insert-only.

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "customers" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "customers" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "customers" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "customers" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "booking_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_sequences" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "booking_sequences" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "booking_sequences" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "booking_sequences" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "booking_sequences" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "bookings" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "bookings" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "bookings" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "bookings" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "booking_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "booking_lines" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "booking_lines" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "booking_lines" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "booking_lines" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "booking_guests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_guests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "booking_guests" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "booking_guests" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "booking_guests" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "booking_guests" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "hotel_booking_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hotel_booking_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "hotel_booking_items" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "hotel_booking_items" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "hotel_booking_items" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "hotel_booking_items" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "trip_booking_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trip_booking_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "trip_booking_items" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "trip_booking_items" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "trip_booking_items" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "trip_booking_items" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "transport_booking_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transport_booking_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "transport_booking_items" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "transport_booking_items" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "transport_booking_items" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "transport_booking_items" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "club_booking_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "club_booking_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "club_booking_items" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "club_booking_items" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "club_booking_items" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "club_booking_items" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "payments" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "payments" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id() AND (kind = 'PAYMENT' OR app_is_super() OR app_role() = 'SUPPLIER_ADMIN'));
CREATE POLICY tenant_update ON "payments" FOR UPDATE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN')) WITH CHECK (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));
CREATE POLICY tenant_delete ON "payments" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "booking_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "booking_events" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "booking_events" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());


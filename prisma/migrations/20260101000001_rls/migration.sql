-- Row level security: a database-level safety net behind the SupplierID filter in the API.
-- Every API request must run inside ONE transaction that first sets:
--   SELECT set_config('app.role', '<ROLE>', true), set_config('app.supplier_id', '<uuid or empty>', true);
-- Login, refresh and password reset run with app.role = 'SYSTEM' (can read users and tokens only).
-- The runtime database user must NOT be a superuser or have BYPASSRLS (see prisma/sql/roles.sql).
-- Missing context = no rows (fails closed).

CREATE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('app.role', true), '') $$;
CREATE FUNCTION app_supplier_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.supplier_id', true), '')::uuid $$;
CREATE FUNCTION app_is_super() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT app_role() = 'SUPER_ADMIN' $$;
CREATE FUNCTION app_platform_supplier_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT id FROM suppliers WHERE is_platform LIMIT 1 $$;

ALTER TABLE "cities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "cities" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id() OR supplier_id = app_platform_supplier_id());
CREATE POLICY tenant_insert ON "cities" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "cities" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "cities" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "amenities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "amenities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "amenities" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id() OR supplier_id = app_platform_supplier_id());
CREATE POLICY tenant_insert ON "amenities" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "amenities" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "amenities" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "categories" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id() OR supplier_id = app_platform_supplier_id());
CREATE POLICY tenant_insert ON "categories" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "categories" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "categories" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "tax_charges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tax_charges" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "tax_charges" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "tax_charges" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "tax_charges" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "tax_charges" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "cancellation_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cancellation_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "cancellation_policies" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "cancellation_policies" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "cancellation_policies" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "cancellation_policies" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "cancellation_policy_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cancellation_policy_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "cancellation_policy_rules" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "cancellation_policy_rules" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "cancellation_policy_rules" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "cancellation_policy_rules" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "media_assets" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "media_assets" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "media_assets" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "media_assets" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "hotels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hotels" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "hotels" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "hotels" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "hotels" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "hotels" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "hotel_amenities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hotel_amenities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "hotel_amenities" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "hotel_amenities" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "hotel_amenities" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "hotel_amenities" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "hotel_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hotel_images" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "hotel_images" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "hotel_images" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "hotel_images" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "hotel_images" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "room_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "room_types" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "room_types" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "room_types" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "room_types" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "room_type_amenities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_type_amenities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "room_type_amenities" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "room_type_amenities" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "room_type_amenities" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "room_type_amenities" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "room_type_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_type_images" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "room_type_images" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "room_type_images" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "room_type_images" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "room_type_images" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "rate_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "rate_plans" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "rate_plans" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "rate_plans" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "rate_plans" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "room_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_inventory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "room_inventory" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "room_inventory" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "room_inventory" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "room_inventory" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "trips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trips" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "trips" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "trips" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "trips" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "trips" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "trip_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trip_images" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "trip_images" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "trip_images" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "trip_images" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "trip_images" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "trip_itinerary_days" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trip_itinerary_days" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "trip_itinerary_days" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "trip_itinerary_days" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "trip_itinerary_days" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "trip_itinerary_days" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "trip_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trip_variants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "trip_variants" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "trip_variants" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "trip_variants" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "trip_variants" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "trip_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trip_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "trip_schedules" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "trip_schedules" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "trip_schedules" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "trip_schedules" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "trip_addons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trip_addons" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "trip_addons" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "trip_addons" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "trip_addons" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "trip_addons" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "vehicle_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "vehicle_types" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "vehicle_types" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "vehicle_types" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "vehicle_types" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "vehicle_type_amenities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_type_amenities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "vehicle_type_amenities" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "vehicle_type_amenities" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "vehicle_type_amenities" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "vehicle_type_amenities" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "vehicle_type_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_type_images" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "vehicle_type_images" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "vehicle_type_images" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "vehicle_type_images" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "vehicle_type_images" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "transport_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transport_zones" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "transport_zones" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "transport_zones" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "transport_zones" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "transport_zones" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "transport_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transport_services" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "transport_services" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "transport_services" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "transport_services" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "transport_services" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "zone_route_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "zone_route_prices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "zone_route_prices" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "zone_route_prices" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "zone_route_prices" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "zone_route_prices" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "drivers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "drivers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "drivers" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "drivers" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "drivers" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "drivers" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "vehicles" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "vehicles" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "vehicles" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "vehicles" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "clubs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clubs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "clubs" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "clubs" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "clubs" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "clubs" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "club_opening_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "club_opening_hours" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "club_opening_hours" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "club_opening_hours" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "club_opening_hours" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "club_opening_hours" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "club_amenities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "club_amenities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "club_amenities" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "club_amenities" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "club_amenities" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "club_amenities" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "club_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "club_images" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "club_images" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "club_images" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "club_images" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "club_images" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "club_ticket_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "club_ticket_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "club_ticket_types" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "club_ticket_types" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "club_ticket_types" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "club_ticket_types" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "club_table_packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "club_table_packages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "club_table_packages" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "club_table_packages" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "club_table_packages" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "club_table_packages" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "club_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "club_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "club_events" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_insert ON "club_events" FOR INSERT WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_update ON "club_events" FOR UPDATE USING (app_is_super() OR supplier_id = app_supplier_id()) WITH CHECK (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY tenant_delete ON "club_events" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));

ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;
CREATE POLICY supplier_select ON "suppliers" FOR SELECT USING (app_is_super() OR id = app_supplier_id());
CREATE POLICY supplier_write ON "suppliers" FOR ALL USING (app_is_super()) WITH CHECK (app_is_super());

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY user_select ON "users" FOR SELECT USING (app_is_super() OR app_role() = 'SYSTEM' OR supplier_id = app_supplier_id());
CREATE POLICY user_insert ON "users" FOR INSERT WITH CHECK (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN' AND role <> 'SUPER_ADMIN'));
CREATE POLICY user_update ON "users" FOR UPDATE USING (app_is_super() OR app_role() = 'SYSTEM' OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN')) WITH CHECK (app_is_super() OR app_role() = 'SYSTEM' OR (supplier_id = app_supplier_id() AND role <> 'SUPER_ADMIN'));
CREATE POLICY user_delete ON "users" FOR DELETE USING (app_is_super());

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_select ON "audit_logs" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());
CREATE POLICY audit_insert ON "audit_logs" FOR INSERT WITH CHECK (app_role() <> '');

-- Reference data: everyone signed in may read, only SUPER_ADMIN may change
ALTER TABLE "countries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "countries" FORCE ROW LEVEL SECURITY;
CREATE POLICY ref_read ON "countries" FOR SELECT USING (app_role() <> '');
CREATE POLICY ref_write ON "countries" FOR ALL USING (app_is_super()) WITH CHECK (app_is_super());
ALTER TABLE "currencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "currencies" FORCE ROW LEVEL SECURITY;
CREATE POLICY ref_read ON "currencies" FOR SELECT USING (app_role() <> '');
CREATE POLICY ref_write ON "currencies" FOR ALL USING (app_is_super()) WITH CHECK (app_is_super());

-- Auth tables: only the SYSTEM role (auth service) may touch them
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY system_only ON "refresh_tokens" FOR ALL USING (app_role() = 'SYSTEM') WITH CHECK (app_role() = 'SYSTEM');
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY system_only ON "password_reset_tokens" FOR ALL USING (app_role() = 'SYSTEM') WITH CHECK (app_role() = 'SYSTEM');
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_attempts" FORCE ROW LEVEL SECURITY;
CREATE POLICY system_only ON "login_attempts" FOR ALL USING (app_role() = 'SYSTEM') WITH CHECK (app_role() = 'SYSTEM');

-- Supabase hardening: tables in the public schema are exposed through the auto-generated REST API (PostgREST).
-- This app talks to Postgres through Prisma only, so remove all API-role privileges.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN EXECUTE 'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon; REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated; REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
  END IF;
END $$;

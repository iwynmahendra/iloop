-- The auth service (SYSTEM role) needs two more read rights:
-- 1) suppliers: to refuse login/refresh for inactive or suspended suppliers.
-- 2) audit_logs: INSERT ... RETURNING (what Prisma issues) also needs a matching SELECT policy, and login audit rows
--    have no supplier before authentication succeeds.
DROP POLICY supplier_select ON "suppliers";
CREATE POLICY supplier_select ON "suppliers" FOR SELECT USING (app_is_super() OR app_role() = 'SYSTEM' OR id = app_supplier_id());
DROP POLICY audit_select ON "audit_logs";
CREATE POLICY audit_select ON "audit_logs" FOR SELECT USING (app_is_super() OR app_role() = 'SYSTEM' OR supplier_id = app_supplier_id());

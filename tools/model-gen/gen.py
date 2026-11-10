import os, sys
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))
from spec import *
OUT = ROOT
def trunc(n): return n if len(n) <= 63 else n[:54] + '_' + hashlib.md5(n.encode()).hexdigest()[:8]
def parse(fs):
    m = re.match(r"^(\w+)\s+([a-z]+(?:\([\d,]+\))?|e:\w+)(\?)?(?:\s*=\s*(.+))?$", fs)
    if not m: raise Exception('bad field '+fs)
    name, t, opt, d = m.groups()
    f = dict(name=name, col=snake(name), opt=bool(opt), dflt=d, enum=None, arr=False)
    base = re.match(r'([a-z]+)(?:\(([\d,]+)\))?', t); k, arg = base.group(1), base.group(2)
    if t.startswith('e:'): f.update(ptype=t[2:], pat='', sql='"%s"' % t[2:], enum=t[2:])
    elif k == 's': f.update(ptype='String', pat=('@db.VarChar(%s)'%arg) if arg else '', sql=('VARCHAR(%s)'%arg) if arg else 'TEXT')
    elif k == 'i': f.update(ptype='Int', pat='', sql='INTEGER')
    elif k == 'bi': f.update(ptype='BigInt', pat='', sql='BIGINT')
    elif k == 'd': f.update(ptype='Decimal', pat='@db.Decimal(%s)'%arg, sql='DECIMAL(%s)'%arg)
    elif k == 'b': f.update(ptype='Boolean', pat='', sql='BOOLEAN')
    elif k == 'dt': f.update(ptype='DateTime', pat='@db.Timestamptz(6)', sql='TIMESTAMPTZ(6)')
    elif k == 'dd': f.update(ptype='DateTime', pat='@db.Date', sql='DATE')
    elif k == 'j': f.update(ptype='Json', pat='', sql='JSONB')
    elif k == 'u': f.update(ptype='String', pat='@db.Uuid', sql='UUID')
    elif k == 'ch': f.update(ptype='String', pat='@db.Char(%s)'%arg, sql='CHAR(%s)'%arg)
    elif k == 't': f.update(ptype='String', pat='@db.VarChar(5)', sql='VARCHAR(5)')
    elif k == 'a': f.update(ptype='String', pat='', sql='TEXT[]', arr=True)
    else: raise Exception('type '+t)
    return f
AUDIT = ['status e:RecordStatus=ACTIVE','createdBy u?','updatedBy u?','createdAt dt=now','updatedAt dt=now','deletedAt dt?']
for n in ORDER:
    m = M[n]; raw = m['fields']
    fl = (['id u','supplierId u'] + raw + AUDIT) if m['kind']=='tenant' else (['id u'] + raw + AUDIT) if m['kind']=='global' else raw
    m['F'] = [parse(x) for x in fl]; m['byname'] = {f['name']: f for f in m['F']}
    if m['kind'] == 'tenant':
        m['rel'] = [R('supplierId','Supplier',comp=False,name=n+'_supplier',back=plural(lower_first(n)))] + m['rel']
        m['ix'] = [['supplierId','status']] + m['ix']
for n in ORDER:
    for r in M[n]['rel']:
        r['name'] = r['name'] or '%s_%s' % (n, r['f'][:-2] if r['f'].endswith('Id') else r['f'][:-4])
        r['fieldname'] = r['f'][:-2] if r['f'].endswith('Id') else r['f'][:-4]
        r['back'] = r['back'] or plural(lower_first(n))
        if r['comp'] and r['to'] != n or (r['comp'] and r['to']==n): M[r['to']]['needsSup'] = True
def cols(m, names): return [m['byname'][x]['col'] for x in names]
def idxname(m, names, suf): return trunc('%s_%s_%s' % (m['table'], '_'.join(cols(m, names)), suf))
for n in ORDER:
    m = M[n]
    if m.get('needsSup') and ['supplierId','id'] not in m['uq']: m['uq'].append(['supplierId','id'])
    for r in m['rel']:
        c = ['supplierId', r['f']] if r['comp'] else [r['f']]
        if not any(x[:len(c)] == c for x in m['uq'] + m['ix']): m['ix'].append(c)
def sql_default(f):
    d = f['dflt']
    if f['name'] == 'id': return 'gen_random_uuid()'
    if d is None: return None
    if f['enum']: return "'%s'" % d
    if f['sql'] in ('BOOLEAN','INTEGER') or f['sql'].startswith('DECIMAL'): return d
    if f['sql'].startswith('TIMESTAMPTZ'): return 'CURRENT_TIMESTAMP'
    if f['sql'] == 'JSONB': return "'%s'" % d
    if f['sql'] == 'TEXT[]': return 'ARRAY[]::TEXT[]'
    return d if d.startswith("'") else "'%s'" % d
def prisma_default(f, m):
    d = f['dflt']
    if f['name'] == 'id': return '@default(dbgenerated("gen_random_uuid()"))'
    if m['name'] == 'Supplier' and f['name'] == 'code': return '@default(dbgenerated("((\'SUP-\'::text || lpad((nextval(\'supplier_code_seq\'::regclass))::text, 4, \'0\'::text)))"))'
    if d is None: return ''
    if f['enum'] or f['ptype'] in ('Boolean','Int','Decimal'): return '@default(%s)' % d
    if f['ptype'] == 'DateTime': return '@default(now())'
    if f['ptype'] == 'Json': return '@default("%s")' % d
    if f['arr']: return '@default([])'
    return '@default("%s")' % d.strip("'")
def ddl_default(f, m):
    if m['name'] == 'Supplier' and f['name'] == 'code': return "('SUP-' || lpad(nextval('supplier_code_seq')::text, 4, '0'))"
    return sql_default(f)
P = ['// Generated together with migrations/*/migration.sql from one model definition.',
     '// Supabase: DATABASE_URL = pooled (pgbouncer) URL for the app, DIRECT_URL = direct URL for migrations.',
     'generator client {', '  provider   = "prisma-client-js"', '  engineType = "client"', '}', '',
     'datasource db {', '  provider  = "postgresql"', '  url       = env("DATABASE_URL")', '  directUrl = env("DIRECT_URL")', '}', '']
for e, vals in ENUMS.items(): P += ['enum %s {' % e] + ['  ' + v for v in vals] + ['}', '']
back = {n: [] for n in ORDER}
for n in ORDER:
    for r in M[n]['rel']: back[r['to']].append((r['back'], n, r['name']))
for n in ORDER:
    m = M[n]; L = []
    if m['note']: P.append('/// ' + m['note'])
    names = set(f['name'] for f in m['F'])
    for f in m['F']:
        t = f['ptype'] + ('[]' if f['arr'] else ('?' if f['opt'] else '')); attrs = []
        if f['name'] == 'id': attrs.append('@id(map: "%s_pkey")' % m['table'])
        if f['name'] == 'updatedAt': attrs.append('@default(now()) @updatedAt')
        else:
            pd = prisma_default(f, m)
            if pd: attrs.append(pd)
        if f['pat']: attrs.append(f['pat'])
        if f['col'] != f['name']: attrs.append('@map("%s")' % f['col'])
        L.append((f['name'], t, ' '.join(attrs)))
    for r in m['rel']:
        names.add(r['fieldname']); fo = m['byname'][r['f']]
        fk = ['supplierId', r['f']] if r['comp'] else [r['f']]; rf = ['supplierId', 'id'] if r['comp'] else [r['ref']]
        fkn = trunc('%s_%s_fkey' % (m['table'], '_'.join(cols(m, fk))))
        L.append((r['fieldname'], r['to'] + ('?' if fo['opt'] else ''), '@relation("%s", fields: [%s], references: [%s], onDelete: %s, onUpdate: Cascade, map: "%s")' % (r['name'], ', '.join(fk), ', '.join(rf), r['od'], fkn)))
    for (bn, child, rn) in back[n]:
        if bn in names: raise Exception('collision %s.%s' % (n, bn))
        names.add(bn); L.append((bn, child + '[]', '@relation("%s")' % rn))
    w1 = max(len(x[0]) for x in L); w2 = max(len(x[1]) for x in L)
    P.append('model %s {' % n)
    for a, b, c in L: P.append(('  %s %s %s' % (a.ljust(w1), b.ljust(w2), c)).rstrip())
    P.append('')
    for u in m['uq']: P.append('  @@unique([%s], map: "%s")' % (', '.join(u), idxname(m, u, 'key')))
    for i in m['ix']: P.append('  @@index([%s], map: "%s")' % (', '.join(i), idxname(m, i, 'idx')))
    P += ['  @@map("%s")' % m['table'], '}', '']
d1 = OUT + '/prisma/migrations/20260101000000_init'; d2 = OUT + '/prisma/migrations/20260101000001_rls'
os.makedirs(d1, exist_ok=True); os.makedirs(d2, exist_ok=True)
open(OUT + '/prisma/schema.prisma', 'w').write('\n'.join(P))
open(OUT + '/prisma/migrations/migration_lock.toml', 'w').write('# Please do not edit this file manually\nprovider = "postgresql"\n')
S = ['-- Init: enums, sequence, tables, indexes, foreign keys, check constraints, triggers.', '-- Generated together with prisma/schema.prisma.', '',
     'CREATE SCHEMA IF NOT EXISTS extensions;', 'CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;', '', 'CREATE SEQUENCE supplier_code_seq START 1;', '']
for e, vals in ENUMS.items(): S.append('CREATE TYPE "%s" AS ENUM (%s);' % (e, ', '.join("'%s'" % v for v in vals)))
S.append('')
for n in ORDER:
    m = M[n]; S += ['-- CreateTable %s' % m['table'], 'CREATE TABLE "%s" (' % m['table']]
    for f in m['F']:
        d = ddl_default(f, m); S.append('    "%s" %s%s%s,' % (f['col'], f['sql'], '' if f['opt'] else ' NOT NULL', (' DEFAULT ' + d) if d else ''))
    S += ['    CONSTRAINT "%s_pkey" PRIMARY KEY ("id")' % m['table'], ');', '']
for n in ORDER:
    m = M[n]
    for u in m['uq']: S.append('CREATE UNIQUE INDEX "%s" ON "%s"(%s);' % (idxname(m, u, 'key'), m['table'], ', '.join('"%s"' % c for c in cols(m, u))))
    for i in m['ix']: S.append('CREATE INDEX "%s" ON "%s"(%s);' % (idxname(m, i, 'idx'), m['table'], ', '.join('"%s"' % c for c in cols(m, i))))
S.append('')
for n in ORDER:
    m = M[n]
    for r in m['rel']:
        fk = ['supplierId', r['f']] if r['comp'] else [r['f']]; rc = ['supplier_id', 'id'] if r['comp'] else [snake(r['ref'])]
        S.append('ALTER TABLE "%s" ADD CONSTRAINT "%s" FOREIGN KEY (%s) REFERENCES "%s"(%s) ON DELETE %s ON UPDATE CASCADE;' % (m['table'], trunc('%s_%s_fkey' % (m['table'], '_'.join(cols(m, fk)))), ', '.join('"%s"' % c for c in cols(m, fk)), M[r['to']]['table'], ', '.join('"%s"' % c for c in rc), r['od'].upper()))
S += ['', '-- Check constraints (not expressible in Prisma, ignored by the client)']
for n in ORDER:
    m = M[n]
    for (cn, expr) in m['chk']: S.append('ALTER TABLE "%s" ADD CONSTRAINT "%s_%s_check" CHECK (%s);' % (m['table'], m['table'], cn, expr))
S += ['', '-- A rate plan may not overlap another live plan of the same room type and meal plan',
      'ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_no_overlap" EXCLUDE USING gist ("supplier_id" WITH =, "room_type_id" WITH =, "meal_plan" WITH =, daterange("date_from", "date_to", \'[]\') WITH &&) WHERE ("deleted_at" IS NULL);', '',
      '-- audit_logs is append-only',
      "CREATE FUNCTION audit_logs_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END $$;",
      'CREATE TRIGGER audit_logs_no_change BEFORE UPDATE OR DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();', '']
open(d1 + '/migration.sql', 'w').write('\n'.join(S))
tenant = [M[n] for n in ORDER if M[n]['kind'] == 'tenant']; SHARED_READ = {'cities','amenities','categories'}
R2 = ['-- Row level security: a database-level safety net behind the SupplierID filter in the API.',
 '-- Every API request must run inside ONE transaction that first sets:',
 "--   SELECT set_config('app.role', '<ROLE>', true), set_config('app.supplier_id', '<uuid or empty>', true);",
 "-- Login, refresh and password reset run with app.role = 'SYSTEM' (can read users and tokens only).",
 '-- The runtime database user must NOT be a superuser or have BYPASSRLS (see prisma/sql/roles.sql).',
 '-- Missing context = no rows (fails closed).', '',
 "CREATE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('app.role', true), '') $$;",
 "CREATE FUNCTION app_supplier_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.supplier_id', true), '')::uuid $$;",
 "CREATE FUNCTION app_is_super() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT app_role() = 'SUPER_ADMIN' $$;",
 "CREATE FUNCTION app_platform_supplier_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT id FROM suppliers WHERE is_platform LIMIT 1 $$;", '']
def enable(t): return ['ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY;' % t, 'ALTER TABLE "%s" FORCE ROW LEVEL SECURITY;' % t]
for m in tenant:
    t = m['table']; R2 += enable(t)
    own = 'app_is_super() OR supplier_id = app_supplier_id()'
    sel = own + (' OR supplier_id = app_platform_supplier_id()' if t in SHARED_READ else '')
    R2 += ['CREATE POLICY tenant_select ON "%s" FOR SELECT USING (%s);' % (t, sel), 'CREATE POLICY tenant_insert ON "%s" FOR INSERT WITH CHECK (%s);' % (t, own),
           'CREATE POLICY tenant_update ON "%s" FOR UPDATE USING (%s) WITH CHECK (%s);' % (t, own, own),
           "CREATE POLICY tenant_delete ON \"%s\" FOR DELETE USING (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN'));" % t, '']
R2 += enable('suppliers') + ["CREATE POLICY supplier_select ON \"suppliers\" FOR SELECT USING (app_is_super() OR id = app_supplier_id());", 'CREATE POLICY supplier_write ON "suppliers" FOR ALL USING (app_is_super()) WITH CHECK (app_is_super());', '']
R2 += enable('users') + [
 "CREATE POLICY user_select ON \"users\" FOR SELECT USING (app_is_super() OR app_role() = 'SYSTEM' OR supplier_id = app_supplier_id());",
 "CREATE POLICY user_insert ON \"users\" FOR INSERT WITH CHECK (app_is_super() OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN' AND role <> 'SUPER_ADMIN'));",
 "CREATE POLICY user_update ON \"users\" FOR UPDATE USING (app_is_super() OR app_role() = 'SYSTEM' OR (supplier_id = app_supplier_id() AND app_role() = 'SUPPLIER_ADMIN')) WITH CHECK (app_is_super() OR app_role() = 'SYSTEM' OR (supplier_id = app_supplier_id() AND role <> 'SUPER_ADMIN'));",
 'CREATE POLICY user_delete ON "users" FOR DELETE USING (app_is_super());', '']
R2 += enable('audit_logs') + ['CREATE POLICY audit_select ON "audit_logs" FOR SELECT USING (app_is_super() OR supplier_id = app_supplier_id());', 'CREATE POLICY audit_insert ON "audit_logs" FOR INSERT WITH CHECK (app_role() <> \'\');', '']
R2 += ['-- Reference data: everyone signed in may read, only SUPER_ADMIN may change']
for t in ['countries','currencies']:
    R2 += enable(t) + ['CREATE POLICY ref_read ON "%s" FOR SELECT USING (app_role() <> \'\');' % t, 'CREATE POLICY ref_write ON "%s" FOR ALL USING (app_is_super()) WITH CHECK (app_is_super());' % t]
R2 += ['', '-- Auth tables: only the SYSTEM role (auth service) may touch them']
for t in ['refresh_tokens','password_reset_tokens','login_attempts']:
    R2 += enable(t) + ['CREATE POLICY system_only ON "%s" FOR ALL USING (app_role() = \'SYSTEM\') WITH CHECK (app_role() = \'SYSTEM\');' % t]
R2 += ['', '-- Supabase hardening: tables in the public schema are exposed through the auto-generated REST API (PostgREST).',
 '-- This app talks to Postgres through Prisma only, so remove all API-role privileges.',
 'DO $$', 'BEGIN',
 "  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN EXECUTE 'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY'; END IF;",
 "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN",
 '    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon; REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;',
 '    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;', '  END IF;',
 "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN",
 '    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated; REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;',
 '    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;', '  END IF;', 'END $$;', '']
open(d2 + '/migration.sql', 'w').write('\n'.join(R2))
D = {}
for g, mem in GROUPS.items():
    L = ['erDiagram']
    for n in mem:
        m = M[n]; L.append('  %s {' % n)
        for f in m['F']:
            isfk = any(r['f'] == f['name'] for r in m['rel'])
            tag = 'PK' if f['name']=='id' else 'FK' if isfk else 'UK' if any([f['name']]==u for u in m['uq']) or (f['name'] in ('code',) and any(f['name'] in u for u in m['uq'])) else ''
            if tag or f['name'] in ('name','title','email','role','type','kind','status'):
                L.append('    %s %s %s' % ('enum' if f['enum'] else re.sub(r'\W','',f['ptype'].lower()), f['name'], tag))
        L.append('  }')
        for r in m['rel']:
            if r['to'] == 'Supplier' and n != 'User': continue
            opt = m['byname'][r['f']]['opt']
            L.append('  %s %s--o{ %s : "%s"' % (r['to'], '|o' if opt else '||', n, r['fieldname']))
    D[g] = '\n'.join(L)
json.dump(D, open(os.path.dirname(__file__) + '/erd.json', 'w'))
print('tables:', len(ORDER), 'tenant:', len(tenant), 'schema lines:', len(P), 'init sql:', len(S), 'rls:', len(R2))

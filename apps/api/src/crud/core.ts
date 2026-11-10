import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { Request } from 'express';
import { withSystem, type Tx } from '../db.js';
import { AppError, badRequest } from '../http.js';
import type { Scope } from '../types.js';
import type { FieldDef, ResourceDef } from './types.js';

// ---------- validation schemas (built from the generated field metadata) ----------
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function fieldSchema(f: FieldDef): z.ZodType {
  let s: z.ZodType;
  switch (f.t) {
    case 'uuid': s = z.string().uuid(); break;
    case 'string': s = f.max ? z.string().trim().min(1).max(f.max) : z.string().trim().min(1).max(20000); break;
    case 'char': s = z.string().trim().length(f.max ?? 2).transform((v) => v.toUpperCase()); break;
    case 'int': case 'bigint': s = z.number().int().min(-2147483648).max(2147483647); break;
    case 'decimal': s = z.union([z.number(), z.string().regex(/^-?\d{1,10}(\.\d{1,6})?$/, 'Invalid number')]); break;
    case 'bool': s = z.boolean(); break;
    case 'date': s = z.string().regex(DATE, 'Use YYYY-MM-DD').refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'); break;
    case 'datetime': s = z.string().datetime({ offset: true }); break;
    case 'json': s = z.any(); break;
    case 'time': s = z.string().regex(TIME, 'Use HH:MM (24h)'); break;
    case 'array': s = z.array(z.string().trim().min(1).max(500)).max(100); break;
    case 'enum': s = z.enum(f.values as [string, ...string[]]); break;
  }
  if (f.opt) return s.nullish();
  if (f.hasDefault) return s.optional();
  return s;
}

const cache = new Map<string, { create: z.ZodObject<any>; update: z.ZodObject<any> }>();
export function schemasFor(def: ResourceDef) {
  let c = cache.get(def.name);
  if (!c) {
    const shape: Record<string, z.ZodType> = {};
    for (const f of def.fields) shape[f.n] = fieldSchema(f);
    const create = z.object(shape).strict(); // unknown keys (supplierId, id, createdBy ...) are rejected, never trusted
    c = { create, update: create.partial() };
    cache.set(def.name, c);
  }
  return c;
}

/** Validated body -> Prisma data. */
export function toPrisma(def: ResourceDef, body: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const f of def.fields) {
    if (!(f.n in body) || body[f.n] === undefined) continue;
    let v = body[f.n];
    if (v !== null && f.t === 'date') v = new Date(`${v}T00:00:00.000Z`);
    else if (v === null && f.t === 'json') v = Prisma.JsonNull;
    else if (f.t === 'bigint' && v !== null) v = BigInt(v);
    out[f.n] = v;
  }
  return out;
}

// ---------- tenant scoping ----------
let platformId: string | null = null;
export async function getPlatformId(): Promise<string> {
  if (platformId) return platformId;
  const p = await withSystem((tx) => tx.supplier.findFirst({ where: { isPlatform: true }, select: { id: true } }));
  if (!p) throw new AppError(500, 'Platform supplier (SUP-0000) is missing: run the seed');
  return (platformId = p.id);
}

/** Supplier a write goes to. Throws if a SUPER_ADMIN has not chosen one. */
export async function writeSupplier(def: ResourceDef, scope: Scope): Promise<string | null> {
  if (!def.tenant) return null;
  if (scope.supplierId) return scope.supplierId;
  if (def.sharedRead) return getPlatformId(); // super admin edits platform reference data by default
  throw badRequest('Choose a supplier first (X-Supplier-Id) to create data as a SUPER_ADMIN');
}

/** Supplier filter for reads. Non-super users: own supplier (plus platform rows for shared reference data). */
export async function readSupplierFilter(def: ResourceDef, scope: Scope): Promise<Record<string, any>> {
  if (!def.tenant) return {};
  if (scope.role === 'SUPER_ADMIN') {
    if (!scope.supplierId) return {};
    // Viewing one supplier: still include platform reference data (cities, amenities, categories) that supplier can use.
    return def.sharedRead ? { supplierId: { in: [scope.supplierId, await getPlatformId()] } } : { supplierId: scope.supplierId };
  }
  if (def.sharedRead) return { supplierId: { in: [scope.supplierId!, await getPlatformId()] } };
  return { supplierId: scope.supplierId! };
}
/** Supplier filter for mutations: never platform rows for non-super users. */
export function writeSupplierFilter(def: ResourceDef, scope: Scope, platform?: string): Record<string, any> {
  if (!def.tenant) return {};
  if (scope.supplierId) return { supplierId: scope.supplierId };
  if (scope.role === 'SUPER_ADMIN') return def.sharedRead && platform ? { supplierId: platform } : {};
  return { supplierId: '00000000-0000-0000-0000-000000000000' }; // cannot happen: non-super always has a supplier
}

// ---------- list query ----------
const coerce = (f: FieldDef, raw: string): any => {
  const v = (() => {
    if (f.t === 'bool') { if (raw !== 'true' && raw !== 'false') throw new Error('Use true or false'); return raw === 'true'; }
    if (f.t === 'int' || f.t === 'bigint') { const n = Number(raw); if (!Number.isInteger(n)) throw new Error('Must be an integer'); return n; }
    return raw;
  })();
  const r = (fieldSchema({ ...f, opt: false, hasDefault: false }) as z.ZodType).safeParse(v);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? 'Invalid value');
  return r.data;
};

const FILTERABLE = new Set(['uuid', 'enum', 'bool', 'char', 'int', 'date']);
const SORTABLE = new Set(['uuid', 'string', 'char', 'int', 'decimal', 'bool', 'date', 'datetime', 'time', 'enum', 'bigint']);

export function filterableFields(def: ResourceDef) { return def.fields.filter((f) => FILTERABLE.has(f.t)); }

export function parseListQuery(def: ResourceDef, q: Record<string, any>) {
  const issues: { field: string; message: string }[] = [];
  const num = (k: string, d: number, min: number, max: number) => {
    if (q[k] === undefined || q[k] === '') return d;
    const n = Number(q[k]);
    if (!Number.isInteger(n) || n < min || n > max) { issues.push({ field: k, message: `Must be an integer between ${min} and ${max}` }); return d; }
    return n;
  };
  const page = num('page', 1, 1, 1_000_000), limit = num('limit', 20, 1, 100);
  const where: Record<string, any> = {};
  const and: any[] = [];
  for (const f of filterableFields(def)) {
    const raw = q[f.n];
    if (typeof raw === 'string' && raw !== '') {
      try { where[f.n] = f.t === 'date' ? new Date(`${coerce(f, raw)}T00:00:00.000Z`) : coerce(f, raw); } catch (e: any) { issues.push({ field: f.n, message: e.message }); }
    }
    if (f.t === 'date') {
      for (const [suffix, op] of [['_from', 'gte'], ['_to', 'lte']] as const) {
        const r = q[f.n + suffix];
        if (typeof r === 'string' && r !== '') { try { and.push({ [f.n]: { [op]: new Date(`${coerce(f, r)}T00:00:00.000Z`) } }); } catch (e: any) { issues.push({ field: f.n + suffix, message: e.message }); } }
      }
    }
  }
  if (typeof q.status === 'string' && q.status) {
    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(q.status)) issues.push({ field: 'status', message: 'Invalid status' }); else where.status = q.status;
  }
  const deleted = q.deleted ?? 'exclude';
  if (!['exclude', 'include', 'only'].includes(deleted)) issues.push({ field: 'deleted', message: 'Use exclude, include or only' });
  if (deleted === 'exclude') where.deletedAt = null; else if (deleted === 'only') where.deletedAt = { not: null };
  if (typeof q.q === 'string' && q.q.trim() && def.search.length) {
    and.push({ OR: def.search.map((s) => ({ [s]: { contains: q.q.trim().slice(0, 100), mode: 'insensitive' } })) });
  }
  const sortable = new Set([...def.fields.filter((f) => SORTABLE.has(f.t)).map((f) => f.n), 'createdAt', 'updatedAt']);
  const orderBy: any[] = [];
  if (typeof q.sort === 'string' && q.sort) {
    for (const part of q.sort.split(',').slice(0, 3)) {
      const [name, dir = 'asc'] = part.split(':');
      if (!sortable.has(name!) || !['asc', 'desc'].includes(dir)) issues.push({ field: 'sort', message: `Cannot sort by "${part}"` }); else orderBy.push({ [name!]: dir });
    }
  }
  if (!orderBy.length) orderBy.push({ createdAt: 'desc' });
  orderBy.push({ id: 'asc' });
  if (issues.length) throw new AppError(422, 'Invalid query', issues);
  if (and.length) where.AND = and;
  return { where, orderBy, page, limit, skip: (page - 1) * limit };
}

// ---------- parent / reference checks ----------
/**
 * Every id in the body that points at another table must be visible to this caller (row level security hides other
 * suppliers' rows) AND belong to the supplier we are writing for (or be platform reference data).
 */
export async function checkRefs(tx: Tx, def: ResourceDef, body: Record<string, any>, supplierId: string | null) {
  const issues: { field: string; message: string }[] = [];
  const platform = def.refs.some((r) => ['city', 'amenity', 'category'].includes(r.delegate)) ? await getPlatformId() : null;
  for (const r of def.refs) {
    const id = body[r.field];
    if (!id) continue;
    const row = await (tx as any)[r.delegate].findFirst({ where: { id, deletedAt: null }, select: { id: true, supplierId: true } });
    const sameTenant = row && (!supplierId || row.supplierId === supplierId);
    const platformRow = row && platform && ['city', 'amenity', 'category'].includes(r.delegate) && row.supplierId === platform;
    if (!row || !(sameTenant || platformRow)) issues.push({ field: r.field, message: 'Referenced record not found' });
  }
  if (issues.length) throw new AppError(422, 'Validation failed', issues);
}

export const strip = <T extends Record<string, any>>(o: T) => o;
export const idParam = (req: Request) => {
  const id = String(req.params.id);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AppError(404, 'Not found');
  return id;
};

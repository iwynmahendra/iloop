import type { Router } from 'express';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { config } from '../config.js';
import { withDb } from '../db.js';
import { AppError, badRequest } from '../http.js';
import { auditCtx, writeAudit } from './audit.js';
import { checkRefs, fieldSchema, parseListQuery, readSupplierFilter, toPrisma, writeSupplier } from './core.js';
import type { FieldDef, ResourceDef } from './types.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });
const MAX_ROWS = 2000, MAX_EXPORT = 10000;
const arrSep = '|';

/** CSV/XLSX cell -> typed value, using the same field metadata as the API. Empty cell = not provided / null. */
function cell(f: FieldDef, raw: unknown): unknown {
  if (raw === undefined || raw === null) return undefined;
  if (raw instanceof Date) raw = f.t === 'date' ? raw.toISOString().slice(0, 10) : raw.toISOString();
  const s = String(raw).trim();
  if (s === '') return f.opt ? null : undefined;
  switch (f.t) {
    case 'int': case 'bigint': return Number(s);
    case 'bool': return ['true', '1', 'yes'].includes(s.toLowerCase()) ? true : ['false', '0', 'no'].includes(s.toLowerCase()) ? false : s;
    case 'array': return s.split(arrSep).map((x) => x.trim()).filter(Boolean);
    case 'json': try { return JSON.parse(s); } catch { return s; }
    case 'decimal': return s;
    default: return s;
  }
}

const cellOut = (f: FieldDef, v: unknown) => v === null || v === undefined ? '' : f.t === 'array' ? (v as string[]).join(arrSep) : f.t === 'json' ? JSON.stringify(v) : f.t === 'date' ? new Date(v as Date).toISOString().slice(0, 10) : f.t === 'datetime' ? new Date(v as Date).toISOString() : String(v);

export function mountImportExport(r: Router, def: ResourceDef, writeGuards: RequestHandler[]) {
  const cols = def.fields;

  r.get('/export', async (req, res) => {
    const s = req.scope!;
    const fmt = z.enum(['csv', 'xlsx']).default('csv').parse(req.query.format);
    const { where, orderBy } = parseListQuery(def, req.query);
    const rows = await withDb(s.db, async (tx) => {
      const data = await (tx as any)[def.delegate].findMany({ where: { ...where, ...(await readSupplierFilter(def, s)) }, orderBy, take: MAX_EXPORT });
      await writeAudit(tx, { action: 'EXPORT', entityType: def.name, supplierId: s.supplierId, after: { rows: data.length, format: fmt }, ...auditCtx(req) });
      return data;
    });
    const header = ['id', ...cols.map((c) => c.n)];
    const table = rows.map((row: any) => [row.id, ...cols.map((c) => cellOut(c, row[c.n]))]);
    // Spreadsheet formula injection: prefix cells that start with = + - @ so Excel never evaluates them.
    const safe = (v: string) => (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? `'${v}` : v);
    const safeTable = table.map((row: string[]) => row.map(safe));
    if (fmt === 'csv') {
      res.type('text/csv').attachment(`${def.path}.csv`).send(stringify([header, ...safeTable]));
    } else {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(def.path.slice(0, 31));
      ws.addRow(header); safeTable.forEach((row: string[]) => ws.addRow(row)); ws.getRow(1).font = { bold: true };
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(`${def.path}.xlsx`).send(Buffer.from(await wb.xlsx.writeBuffer()));
    }
  });

  r.post('/import', ...writeGuards, upload.single('file'), async (req, res) => {
    const s = req.scope!;
    if (!req.file) throw badRequest('Attach a file in the "file" field');
    const dryRun = req.query.dryRun === 'true';
    const name = req.file.originalname.toLowerCase();
    let records: Record<string, unknown>[] = [];
    try {
      if (name.endsWith('.csv')) records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, bom: true, trim: true });
      else if (name.endsWith('.xlsx')) {
        const wb = new ExcelJS.Workbook(); await wb.xlsx.load(req.file.buffer as any);
        const ws = wb.worksheets[0]; if (!ws) throw new Error('empty');
        const head = (ws.getRow(1).values as unknown[]).slice(1).map((v) => String(v ?? '').trim());
        ws.eachRow((row, n) => { if (n === 1) return; const o: Record<string, unknown> = {}; head.forEach((h, i) => { const v = row.getCell(i + 1).value; o[h] = v && typeof v === 'object' && 'text' in (v as any) ? (v as any).text : v; }); records.push(o); });
      } else throw new Error('type');
    } catch { throw badRequest('Could not read the file. Use .csv or .xlsx with a header row.'); }
    if (!records.length) throw badRequest('The file has no data rows');
    if (records.length > MAX_ROWS) throw new AppError(413, `At most ${MAX_ROWS} rows per import`);

    const allowed = new Set(cols.map((c) => c.n));
    const errors: { row: number; field?: string; message: string }[] = [];
    const valid: Record<string, any>[] = [];
    records.forEach((rec, i) => {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rec)) {
        if (k === 'id' || k === '') continue;
        const f = cols.find((c) => c.n === k);
        if (!f) { if (i === 0) errors.push({ row: 1, field: k, message: `Unknown column "${k}"` }); continue; }
        const val = cell(f, v); if (val !== undefined) body[k] = val;
      }
      const shape: Record<string, z.ZodType> = {}; for (const c of cols) shape[c.n] = fieldSchema(c);
      const p = z.object(shape).strict().safeParse(body);
      if (p.success) valid.push(p.data); else p.error.issues.forEach((is) => errors.push({ row: i + 2, field: is.path.join('.'), message: is.message }));
    });
    void allowed;
    if (errors.length) throw new AppError(422, `Import rejected: ${errors.length} problem(s). Nothing was saved.`, errors.slice(0, 200));
    if (dryRun) return void res.json({ success: true, data: { rows: valid.length, dryRun: true }, message: 'File is valid', errors: null, meta: null });

    const supplierId = await writeSupplier(def, s);
    const created = await withDb(s.db, async (tx) => {
      for (const [i, body] of valid.entries()) {
        try { await checkRefs(tx, def, body, supplierId); } catch (e: any) { throw new AppError(422, `Row ${i + 2}: ${e.message}`, e.errors?.map((x: any) => ({ row: i + 2, ...x }))); }
      }
      await (tx as any)[def.delegate].createMany({ data: valid.map((b) => ({ ...toPrisma(def, b), ...(def.tenant ? { supplierId } : {}), createdBy: s.userId, updatedBy: s.userId })) });
      await writeAudit(tx, { action: 'IMPORT', entityType: def.name, supplierId, after: { rows: valid.length, file: req.file!.originalname }, ...auditCtx(req) });
      return valid.length;
    });
    res.status(201).json({ success: true, data: { rows: created }, message: `${created} record(s) imported`, errors: null, meta: null });
  });
}

import { useQuery } from '@tanstack/react-query';
import type { FieldDef, ResourceDef } from '../generated/resources';
import { api } from '../lib/api';
import { fmtDate, fmtNumber, humanize } from '../lib/utils';
import { Badge, Field, Input, Select, Switch, Textarea } from './ui';

export type FormState = Record<string, any>;

// ---------- reference lookups ----------
export function RefName({ f, id }: { f: FieldDef; id: string | null | undefined }) {
  const r = f.ref!;
  const q = useQuery({ queryKey: ['ref', r.path, id], enabled: !!id, staleTime: 5 * 60_000, queryFn: () => api<any>(`/${r.group}/${r.path}/${id}`) });
  if (!id) return <span className="text-muted-foreground">—</span>;
  if (q.isLoading) return <span className="text-muted-foreground">…</span>;
  const d = q.data?.data; return <span>{d ? (r.display ? d[r.display] : id.slice(0, 8)) : <span className="text-muted-foreground">(unavailable)</span>}</span>;
}

export function RefSelect({ f, id, value, onChange, invalid, placeholder = '— none —', onlyId }: { f: FieldDef; id?: string; value: string; onChange: (v: string) => void; invalid?: boolean; placeholder?: string; onlyId?: string }) {
  const r = f.ref!;
  const opts = useQuery({ queryKey: ['refopts', r.path], staleTime: 60_000, queryFn: () => api<any[]>(`/${r.group}/${r.path}`, { query: { limit: 100, sort: r.display ? `${r.display}:asc` : undefined } }) });
  const has = value && opts.data?.data.some((o) => o.id === value);
  const cur = useQuery({ queryKey: ['ref', r.path, value], enabled: !!value && !has && opts.isSuccess, queryFn: () => api<any>(`/${r.group}/${r.path}/${value}`) });
  const list = [...(opts.data?.data ?? []), ...(cur.data && !has ? [cur.data.data] : [])];
  return (
    <Select id={id} aria-invalid={invalid} value={value} onChange={(e) => onChange(e.target.value)} disabled={opts.isLoading}>
      <option value="">{opts.isLoading ? 'Loading…' : placeholder}</option>
      {list.filter((o) => !onlyId || o.id !== onlyId).map((o) => <option key={o.id} value={o.id}>{r.display ? o[r.display] : o.id.slice(0, 8)}{o.code && r.display !== 'code' ? ` (${o.code})` : ''}</option>)}
    </Select>
  );
}

function CodeSelect({ f, id, value, onChange, invalid }: { f: FieldDef; id?: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const path = f.codeRef!;
  const q = useQuery({ queryKey: ['codeopts', path], staleTime: 10 * 60_000, queryFn: () => api<any[]>(`/shared/${path}`, { query: { limit: 100, sort: 'name:asc' } }) });
  return (
    <Select id={id} aria-invalid={invalid} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{q.isLoading ? 'Loading…' : '— select —'}</option>
      {q.data?.data.map((o) => <option key={o.code} value={o.code}>{o.code} — {o.name}</option>)}
    </Select>
  );
}

// ---------- form <-> API value conversion ----------
const toLocalDt = (v: string) => { const d = new Date(v); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
export function fromRow(def: ResourceDef, row: any): FormState {
  const s: FormState = {};
  for (const f of def.fields) {
    const v = row?.[f.n];
    s[f.n] = v === null || v === undefined ? (f.t === 'bool' ? false : '')
      : f.t === 'date' ? String(v).slice(0, 10) : f.t === 'datetime' ? toLocalDt(v)
      : f.t === 'array' ? (v as string[]).join('\n') : f.t === 'json' ? JSON.stringify(v, null, 2) : f.t === 'bool' ? !!v : String(v);
  }
  return s;
}
export function emptyState(def: ResourceDef, prefill: Record<string, string> = {}): FormState {
  const s: FormState = {};
  for (const f of def.fields) s[f.n] = f.t === 'bool' ? (f.n === 'isClosed' || f.n === 'stopSell' ? false : true) : f.n === 'status' ? 'ACTIVE' : f.t === 'enum' && f.hasDefault ? f.values![0] : '';
  return { ...s, ...prefill };
}
/** Returns the API body (only changed fields when `initial` is given) and any local parse errors. */
export function toBody(def: ResourceDef, st: FormState, initial?: FormState) {
  const body: Record<string, unknown> = {}; const errors: Record<string, string> = {};
  for (const f of def.fields) {
    const raw = st[f.n];
    if (initial && raw === initial[f.n]) continue;
    const empty = raw === '' || raw === undefined;
    if (empty && f.t !== 'bool') { if (f.opt && initial) body[f.n] = null; else if (f.opt && !initial) { /* skip */ } continue; }
    try {
      switch (f.t) {
        case 'int': case 'bigint': body[f.n] = Number(raw); break;
        case 'bool': body[f.n] = !!raw; break;
        case 'decimal': body[f.n] = String(raw).trim(); break;
        case 'char': body[f.n] = String(raw).trim().toUpperCase(); break;
        case 'datetime': body[f.n] = new Date(raw).toISOString(); break;
        case 'array': body[f.n] = String(raw).split('\n').map((x) => x.trim()).filter(Boolean); break;
        case 'json': body[f.n] = JSON.parse(raw); break;
        default: body[f.n] = typeof raw === 'string' ? raw.trim() : raw;
      }
    } catch { errors[f.n] = f.t === 'json' ? 'Not valid JSON' : 'Invalid value'; }
  }
  return { body, errors };
}

// ---------- editors and read-only display ----------
const LONG = new Set(['description', 'address', 'inclusions', 'exclusions']);
export function FieldInput({ f, value, onChange, error }: { f: FieldDef; value: any; onChange: (v: any) => void; error?: string }) {
  const required = !f.opt && !f.hasDefault;
  const hint = f.t === 'array' ? 'One per line' : f.t === 'json' ? 'JSON' : f.t === 'time' ? '24-hour time' : undefined;
  return (
    <Field label={f.label} error={error} hint={hint} required={required}>
      {(id, inv) => {
        if (f.t === 'bool') return <div className="flex h-9 items-center"><Switch checked={!!value} onChange={onChange} label={f.label} /></div>;
        if (f.ref) return <RefSelect f={f} id={id} value={value} onChange={onChange} invalid={inv} placeholder={required ? '— select —' : '— none —'} />;
        if (f.codeRef) return <CodeSelect f={f} id={id} value={value} onChange={onChange} invalid={inv} />;
        if (f.t === 'enum') return <Select id={id} aria-invalid={inv} value={value} onChange={(e) => onChange(e.target.value)}>{f.opt && <option value="">—</option>}{f.values!.map((v) => <option key={v} value={v}>{humanize(v)}</option>)}</Select>;
        if (f.t === 'array' || f.t === 'json' || (f.t === 'string' && (!f.max || LONG.has(f.n)))) return <Textarea id={id} aria-invalid={inv} rows={f.t === 'json' ? 6 : 3} className={f.t === 'json' ? 'font-mono text-xs' : ''} value={value} onChange={(e) => onChange(e.target.value)} />;
        const type = f.t === 'int' || f.t === 'bigint' ? 'number' : f.t === 'date' ? 'date' : f.t === 'datetime' ? 'datetime-local' : f.t === 'time' ? 'time' : 'text';
        return <Input id={id} aria-invalid={inv} type={type} inputMode={f.t === 'decimal' ? 'decimal' : undefined} maxLength={f.max} value={value} onChange={(e) => onChange(e.target.value)} step={f.t === 'int' ? 1 : f.t === 'time' ? 60 : undefined} />;
      }}
    </Field>
  );
}

export function CellValue({ f, row }: { f: FieldDef; row: any }) {
  const v = row[f.n];
  if (f.ref) return <RefName f={f} id={v} />;
  if (v === null || v === undefined || v === '') return <span className="text-muted-foreground">—</span>;
  switch (f.t) {
    case 'enum': return <Badge tone="neutral">{humanize(String(v))}</Badge>;
    case 'bool': return <span>{v ? 'Yes' : 'No'}</span>;
    case 'decimal': case 'int': case 'bigint': return <span className="tabular-nums">{fmtNumber(v)}</span>;
    case 'date': return <span className="tabular-nums">{fmtDate(v)}</span>;
    case 'datetime': return <span className="tabular-nums">{fmtDate(v, true)}</span>;
    case 'array': return <span>{(v as string[]).length} item(s)</span>;
    case 'json': return <span className="text-muted-foreground">{'{…}'}</span>;
    default: return <span className="block max-w-[16rem] truncate" title={String(v)}>{String(v)}</span>;
  }
}

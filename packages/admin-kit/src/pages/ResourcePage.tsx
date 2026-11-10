import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Download, Eye, Pencil, Plus, RotateCcw, Search, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CellValue, RefName, RefSelect } from '../components/fields';
import ResourceDetail from '../components/ResourceDetail';
import ResourceForm from '../components/ResourceForm';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Modal, Pagination, Select, Spinner, StatusBadge, Switch, Table, Td, Th } from '../components/ui';
import { resources, type ResourceDef } from '../generated/resources';
import { useDebounced } from '../hooks/useDebounced';
import { api, ApiError, download } from '../lib/api';
import { useAuth } from '../lib/auth';
import { humanize } from '../lib/utils';

const LIMIT = 20;
const SORTABLE = new Set(['string', 'char', 'int', 'decimal', 'bool', 'date', 'datetime', 'time', 'enum']);
const FILTERABLE = new Set(['uuid', 'enum', 'bool', 'char', 'int', 'date']);

export default function ResourcePage() {
  const { group, path } = useParams();
  const def = resources.find((r) => r.group === group && r.path === path);
  if (!def) return <Navigate to="/" replace />;
  return <ResourceView key={def.name} def={def} />;
}

function ImportDialog({ def, open, onClose }: { def: ResourceDef; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<{ row: number; field?: string; message: string }[]>([]); const [ok, setOk] = useState<string | null>(null);
  useEffect(() => { if (open) { setFile(null); setProblems([]); setOk(null); } }, [open]);
  const run = async (dryRun: boolean) => {
    if (!file) return; setBusy(true); setProblems([]); setOk(null);
    try {
      const fd = new FormData(); fd.set('file', file);
      const r = await api<{ rows: number }>(`/${def.group}/${def.path}/import`, { method: 'POST', form: fd, query: { dryRun } });
      if (dryRun) setOk(`File is valid: ${r.data.rows} row(s) ready to import.`); else { toast.success(r.message); qc.invalidateQueries({ queryKey: ['list', def.path] }); onClose(); }
    } catch (e) { const x = e as ApiError; setProblems((x.errors as any) ?? [{ row: 0, message: x.message }]); if (!x.errors) toast.error(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Import ${def.plural.toLowerCase()}`} footer={<><Button variant="outline" onClick={onClose}>Close</Button><Button variant="secondary" disabled={!file} loading={busy} onClick={() => run(true)}>Check file</Button><Button disabled={!file} loading={busy} onClick={() => run(false)}>Import</Button></>}>
      <div className="space-y-3 text-sm">
        <p>Upload a <b>.csv</b> or <b>.xlsx</b> file (max 2000 rows). The first row must be column names. Tip: export first to get the exact columns. Related records are given by their ID; lists use <code>|</code> between items. If any row is invalid nothing is imported.</p>
        <p className="text-xs text-muted-foreground">Columns: {def.fields.map((f) => f.n + (!f.opt && !f.hasDefault ? '*' : '')).join(', ')}</p>
        <Input type="file" accept=".csv,.xlsx" aria-label="File to import" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setProblems([]); setOk(null); }} />
        {ok && <p role="status" className="text-success">{ok}</p>}
        {problems.length > 0 && <ul role="alert" className="max-h-48 space-y-1 overflow-auto rounded bg-destructive/10 p-2 text-xs text-destructive">{problems.map((p, i) => <li key={i}>{p.row ? `Row ${p.row}` : 'File'}{p.field ? ` · ${p.field}` : ''}: {p.message}</li>)}</ul>}
      </div>
    </Modal>
  );
}

function ResourceView({ def }: { def: ResourceDef }) {
  const { user, can, scopeSupplier } = useAuth();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const canWrite = def.tenant || user?.role === 'SUPER_ADMIN';
  const canRemove = canWrite && can.remove;
  const needSupplier = user?.role === 'SUPER_ADMIN' && !scopeSupplier && def.tenant && !def.sharedRead;

  const page = Math.max(1, Number(sp.get('page')) || 1);
  const [qText, setQText] = useState(sp.get('q') ?? ''); const dq = useDebounced(qText);
  const sort = sp.get('sort') ?? ''; const status = sp.get('status') ?? ''; const deleted = sp.get('deleted') ?? 'exclude';
  const filterFields = def.fields.filter((f) => FILTERABLE.has(f.t) && f.n !== 'status' && !f.codeRef && f.t !== 'date' && (f.t !== 'uuid' || f.ref));
  const filters = Object.fromEntries(filterFields.map((f) => [f.n, sp.get(f.n) ?? '']).filter(([, v]) => v));
  const update = (patch: Record<string, string | null>, keepPage = false) => setSp((p) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k); if (!keepPage) n.delete('page'); return n; }, { replace: true });
  useEffect(() => { if ((sp.get('q') ?? '') !== dq) update({ q: dq || null }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const params = { page, limit: LIMIT, q: sp.get('q') ?? '', sort: sort || undefined, status, deleted, ...filters };
  const list = useQuery({ queryKey: ['list', def.path, params, scopeSupplier], queryFn: () => api<any[]>(`/${def.group}/${def.path}`, { query: params }), placeholderData: (p) => p });
  const rows = list.data?.data ?? []; const total = list.data?.meta?.total ?? 0;

  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => setSel(new Set()), [list.data]);
  const [form, setForm] = useState<{ row: any | null } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'delete' | 'bulk-delete'; ids: string[]; name?: string }>(null);
  const [importOpen, setImportOpen] = useState(false);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['list', def.path] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['refopts', def.path] }); };

  const toggle = useMutation({ mutationFn: (r: any) => api(`/${def.group}/${def.path}/${r.id}/status`, { method: 'PATCH', body: { status: r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } }), onSuccess: () => { invalidate(); toast.success('Status updated'); }, onError: (e: Error) => toast.error(e.message) });
  const restore = useMutation({ mutationFn: (id: string) => api(`/${def.group}/${def.path}/${id}/restore`, { method: 'POST' }), onSuccess: () => { invalidate(); toast.success('Restored'); }, onError: (e: Error) => toast.error(e.message) });
  const del = useMutation({ mutationFn: (id: string) => api(`/${def.group}/${def.path}/${id}`, { method: 'DELETE' }), onSuccess: () => { invalidate(); toast.success('Deleted'); setConfirm(null); }, onError: (e: Error) => { toast.error(e.message); setConfirm(null); } });
  const bulk = useMutation({ mutationFn: (v: { action: string; ids: string[] }) => api<{ affected: number }>(`/${def.group}/${def.path}/bulk`, { method: 'POST', body: v }), onSuccess: (r) => { invalidate(); toast.success(r.message); setConfirm(null); }, onError: (e: Error) => { toast.error(e.message); setConfirm(null); } });

  const cols = def.columns.map((n) => def.fields.find((f) => f.n === n)!).filter(Boolean);
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const nameOf = (r: any) => (def.display && r[def.display]) || r.id.slice(0, 8);
  const parentFilter = filterFields.filter((f) => f.ref && filters[f.n] && def.fields.some((x) => x.n === f.n));
  const prefill = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([k]) => def.fields.find((f) => f.n === k)?.ref)) as Record<string, string>, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const exportFile = (format: 'csv' | 'xlsx') => download(`/${def.group}/${def.path}/export`, { ...params, page: undefined, limit: undefined, format }, `${def.path}.${format}`).catch((e) => toast.error(e.message));
  const sortBy = (n: string) => { const [cur, dir] = sort.split(':'); update({ sort: cur === n ? (dir === 'asc' ? `${n}:desc` : null) : `${n}:asc` }, true); };
  const enumFilters = filterFields.filter((f) => f.t === 'enum' || f.t === 'bool').slice(0, 3);
  const refFilters = filterFields.filter((f) => f.ref && f.ref.path !== def.path).slice(0, 2);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{def.plural}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportFile('csv')}><Download className="h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportFile('xlsx')}><Download className="h-4 w-4" />Excel</Button>
          {canWrite && <Button variant="outline" size="sm" disabled={needSupplier} onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />Import</Button>}
          {canWrite && <Button size="sm" disabled={needSupplier} title={needSupplier ? 'Choose a supplier in the top bar first' : undefined} onClick={() => setForm({ row: null })}><Plus className="h-4 w-4" />New {def.label.toLowerCase()}</Button>}
        </div>
      </div>
      {needSupplier && <p role="note" className="rounded-md bg-warning/10 p-2.5 text-sm">Choose a supplier in the top bar to create or import {def.plural.toLowerCase()}. You are viewing all suppliers.</p>}
      {!canWrite && <p role="note" className="rounded-md bg-muted p-2.5 text-sm text-muted-foreground">This is shared reference data managed by the platform administrator. You can view it here.</p>}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-8" placeholder={def.search.length ? `Search ${def.search.join(', ')}` : 'Search'} aria-label="Search" value={qText} onChange={(e) => setQText(e.target.value)} /></div>
          {def.fields.some((f) => f.n === 'status') && <Select aria-label="Status" className="w-full sm:w-32" value={status} onChange={(e) => update({ status: e.target.value || null })}><option value="">All status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></Select>}
          {canRemove && <Select aria-label="Deleted records" className="w-full sm:w-36" value={deleted} onChange={(e) => update({ deleted: e.target.value === 'exclude' ? null : e.target.value })}><option value="exclude">Not deleted</option><option value="only">Deleted only</option><option value="include">Include deleted</option></Select>}
          {enumFilters.map((f) => <Select key={f.n} aria-label={f.label} className="w-full sm:w-36" value={filters[f.n] ?? ''} onChange={(e) => update({ [f.n]: e.target.value || null })}><option value="">{f.label}: all</option>{f.t === 'bool' ? <><option value="true">Yes</option><option value="false">No</option></> : f.values!.map((v) => <option key={v} value={v}>{humanize(v)}</option>)}</Select>)}
          {refFilters.map((f) => <div key={f.n} className="w-full sm:w-44"><RefSelect f={f} placeholder={`${f.label}: all`} value={filters[f.n] ?? ''} onChange={(v) => update({ [f.n]: v || null })} /></div>)}
        </div>
        {parentFilter.length > 0 && <div className="flex flex-wrap gap-2 border-b bg-muted/40 px-3 py-2 text-sm">{parentFilter.map((f) => <span key={f.n} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5">{f.label}: <b><RefName f={f} id={filters[f.n]} /></b><button type="button" aria-label={`Clear ${f.label} filter`} onClick={() => update({ [f.n]: null })}><X className="h-3.5 w-3.5" /></button></span>)}</div>}

        {sel.size > 0 && canWrite && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2 text-sm" role="region" aria-label="Bulk actions">
            <b>{sel.size} selected</b>
            {deleted === 'only' ? <Button size="sm" variant="outline" onClick={() => bulk.mutate({ action: 'restore', ids: [...sel] })}>Restore</Button> : <>
              <Button size="sm" variant="outline" onClick={() => bulk.mutate({ action: 'activate', ids: [...sel] })}>Activate</Button>
              <Button size="sm" variant="outline" onClick={() => bulk.mutate({ action: 'deactivate', ids: [...sel] })}>Deactivate</Button>
              {canRemove && <Button size="sm" variant="destructive" onClick={() => setConfirm({ kind: 'bulk-delete', ids: [...sel] })}>Delete</Button>}</>}
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>
          </div>
        )}

        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState title={`No ${def.plural.toLowerCase()} found`} hint={sp.toString() ? 'Try changing or clearing the filters.' : canWrite && !needSupplier ? `Create your first ${def.label.toLowerCase()} to get started.` : undefined}
            action={canWrite && !needSupplier && !sp.toString() ? <Button size="sm" onClick={() => setForm({ row: null })}><Plus className="h-4 w-4" />New {def.label.toLowerCase()}</Button> : undefined} />
        ) : (
          <Table>
            <thead><tr>
              {canWrite && <Th className="w-10"><input type="checkbox" aria-label="Select all" className="h-4 w-4" checked={allOn} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></Th>}
              {cols.map((f) => { const [cur, dir] = sort.split(':'); const can = SORTABLE.has(f.t) && !f.ref; return (
                <Th key={f.n} aria-sort={cur === f.n ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>{can ? <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={() => sortBy(f.n)}>{f.label}{cur === f.n && (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button> : f.label}</Th>); })}
              <Th>Status</Th><Th className="text-right">Actions</Th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`hover:bg-muted/40 ${r.deletedAt ? 'opacity-70' : ''}`}>
                  {canWrite && <Td><input type="checkbox" className="h-4 w-4" aria-label={`Select ${nameOf(r)}`} checked={sel.has(r.id)} onChange={(e) => setSel((p) => { const n = new Set(p); e.target.checked ? n.add(r.id) : n.delete(r.id); return n; })} /></Td>}
                  {cols.map((f, i) => <Td key={f.n}>{i === 0 ? <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setDetail(r.id)}><CellValue f={f} row={r} /></button> : <CellValue f={f} row={r} />}</Td>)}
                  <Td>{r.deletedAt ? <StatusBadge status={r.status} deleted /> : canWrite && 'status' in r ? <Switch checked={r.status === 'ACTIVE'} label={`${nameOf(r)} active`} disabled={toggle.isPending} onChange={() => toggle.mutate(r)} /> : <StatusBadge status={r.status} />}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="icon" aria-label={`View ${nameOf(r)}`} onClick={() => setDetail(r.id)}><Eye className="h-4 w-4" /></Button>
                    {canWrite && !r.deletedAt && <Button variant="ghost" size="icon" aria-label={`Edit ${nameOf(r)}`} onClick={() => setForm({ row: r })}><Pencil className="h-4 w-4" /></Button>}
                    {canRemove && (r.deletedAt ? <Button variant="ghost" size="icon" aria-label={`Restore ${nameOf(r)}`} onClick={() => restore.mutate(r.id)}><RotateCcw className="h-4 w-4" /></Button> : <Button variant="ghost" size="icon" aria-label={`Delete ${nameOf(r)}`} onClick={() => setConfirm({ kind: 'delete', ids: [r.id], name: nameOf(r) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {total > 0 && <div className="border-t px-3"><Pagination page={page} limit={LIMIT} total={total} onPage={(p) => update({ page: String(p) }, true)} /></div>}
      </Card>

      <ResourceForm def={def} open={!!form} row={form?.row ?? null} prefill={prefill} onClose={() => setForm(null)} onSaved={() => setForm(null)} />
      <ResourceDetail def={def} id={detail} onClose={() => setDetail(null)} canWrite={canWrite} onEdit={(row) => { setDetail(null); setForm({ row }); }} />
      <ImportDialog def={def} open={importOpen} onClose={() => setImportOpen(false)} />
      <ConfirmDialog open={!!confirm} danger title={confirm?.kind === 'delete' ? `Delete ${def.label.toLowerCase()}?` : `Delete ${confirm?.ids.length} records?`} confirmLabel="Delete" loading={del.isPending || bulk.isPending}
        message={confirm?.kind === 'delete' ? <>“{confirm.name}” will be hidden everywhere. You can restore it later from “Deleted only”.</> : <>These records will be hidden everywhere. You can restore them later from “Deleted only”.</>}
        onCancel={() => setConfirm(null)} onConfirm={() => confirm && (confirm.kind === 'delete' ? del.mutate(confirm.ids[0]!) : bulk.mutate({ action: 'delete', ids: confirm.ids }))} />
    </div>
  );
}

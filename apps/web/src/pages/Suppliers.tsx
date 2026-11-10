import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Eye, ImageUp, Pencil, Plus, RotateCcw, Search, Trash2, UserPlus } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { RefSelect } from '@/components/fields';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Pagination, Select, Spinner, StatusBadge, Table, Td, Textarea, Th } from '@/components/ui';
import { useDebounced } from '@/hooks/useDebounced';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const EMPTY = { name: '', legalName: '', email: '', phone: '', address: '', countryCode: '', taxId: '', commissionPct: '0', status: 'ACTIVE' };
const LIMIT = 20;
const countryField = { n: 'countryCode', t: 'char', opt: true, hasDefault: false, label: 'Country', codeRef: 'countries' } as const;

function SecretBox({ title, secret, onClose }: { title: string; secret: string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={title} footer={<Button onClick={onClose}>Done</Button>}>
      <p className="text-sm">Share this temporary password securely. <b>It is shown only once</b> and the user must change it at first sign-in.</p>
      <div className="mt-3 flex items-center gap-2"><code className="flex-1 select-all rounded bg-muted px-3 py-2 text-sm">{secret}</code>
        <Button variant="outline" size="icon" aria-label="Copy password" onClick={() => navigator.clipboard?.writeText(secret).then(() => toast.success('Copied'))}><Copy className="h-4 w-4" /></Button></div>
    </Modal>
  );
}

export default function Suppliers() {
  const qc = useQueryClient(); const nav = useNavigate(); const { setScopeSupplier } = useAuth();
  const [page, setPage] = useState(1); const [q, setQ] = useState(''); const dq = useDebounced(q); const [status, setStatus] = useState(''); const [deleted, setDeleted] = useState('exclude');
  const list = useQuery({ queryKey: ['suppliers', page, dq, status, deleted], queryFn: () => api<any[]>('/suppliers', { query: { page, limit: LIMIT, q: dq, status, deleted } }), placeholderData: (p) => p });
  const [form, setForm] = useState<{ row: any | null } | null>(null);
  const [st, setSt] = useState<Record<string, string>>(EMPTY); const [errs, setErrs] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [adminFor, setAdminFor] = useState<any | null>(null); const [adm, setAdm] = useState({ name: '', email: '' }); const [admErr, setAdmErr] = useState<ApiError | null>(null); const [secret, setSecret] = useState<string | null>(null);
  const [del, setDel] = useState<any | null>(null);
  const logo = useRef<HTMLInputElement>(null); const [logoFor, setLogoFor] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  const open = (row: any | null) => { setForm({ row }); setErrs({}); setTop(null); setSt(row ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, row[k] == null ? '' : String(row[k])])) : EMPTY); };
  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErrs({}); setTop(null);
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(st)) { const old = form?.row?.[k]; if (form?.row && String(old ?? '') === v) continue; if (v === '' && !['name', 'email'].includes(k)) { if (form?.row) body[k] = null; continue; } body[k] = v; }
    try { await api(`/suppliers${form?.row ? `/${form.row.id}` : ''}`, { method: form?.row ? 'PATCH' : 'POST', body }); toast.success(form?.row ? 'Supplier updated' : 'Supplier created'); setForm(null); refresh(); }
    catch (x) { const er = x as ApiError; const m: Record<string, string> = {}; er.errors?.forEach((i) => { if (i.field) m[i.field] = i.message; }); setErrs(m); setTop(er.message); } finally { setBusy(false); }
  };
  const setStatusOf = useMutation({ mutationFn: (v: { id: string; status: string }) => api(`/suppliers/${v.id}/status`, { method: 'PATCH', body: { status: v.status } }), onSuccess: () => { refresh(); toast.success('Status updated'); }, onError: (e: Error) => toast.error(e.message) });
  const restore = useMutation({ mutationFn: (id: string) => api(`/suppliers/${id}/restore`, { method: 'POST' }), onSuccess: (r) => { refresh(); toast.success(r.message); }, onError: (e: Error) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: (id: string) => api(`/suppliers/${id}`, { method: 'DELETE' }), onSuccess: () => { refresh(); toast.success('Supplier deleted'); setDel(null); }, onError: (e: Error) => { toast.error(e.message); setDel(null); } });
  const createAdmin = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setAdmErr(null);
    try { const r = await api<any>(`/suppliers/${adminFor.id}/admin`, { method: 'POST', body: adm }); setAdminFor(null); setAdm({ name: '', email: '' }); setSecret(r.data.temporaryPassword); refresh(); toast.success('Supplier admin created'); }
    catch (x) { setAdmErr(x as ApiError); } finally { setBusy(false); }
  };
  const uploadLogo = async (file: File) => {
    try { const fd = new FormData(); fd.set('file', file); await api(`/suppliers/${logoFor}/logo`, { method: 'POST', form: fd }); toast.success('Logo updated'); refresh(); } catch (e) { toast.error((e as Error).message); }
  };
  const rows = list.data?.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-semibold">Suppliers</h1><Button size="sm" onClick={() => open(null)}><Plus className="h-4 w-4" />New supplier</Button></div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-8" aria-label="Search" placeholder="Search name, code, email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Select aria-label="Status" className="w-36" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></Select>
          <Select aria-label="Deleted" className="w-36" value={deleted} onChange={(e) => { setDeleted(e.target.value); setPage(1); }}><option value="exclude">Not deleted</option><option value="only">Deleted only</option></Select>
        </div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} /> : rows.length === 0 ? <EmptyState title="No suppliers found" /> : (
          <Table><thead><tr><Th>Code</Th><Th>Name</Th><Th>Email</Th><Th>Commission</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.id} className="hover:bg-muted/40">
                <Td className="font-mono text-xs">{s.code}</Td>
                <Td><div className="flex items-center gap-2">{s.logoUrl ? <img src={s.logoUrl} alt="" className="h-7 w-7 rounded object-cover" /> : <span className="h-7 w-7 rounded bg-muted" aria-hidden />}<span className="font-medium">{s.name}</span></div></Td>
                <Td>{s.email}</Td><Td className="tabular-nums">{Number(s.commissionPct)}%</Td>
                <Td>{s.deletedAt ? <StatusBadge status={s.status} deleted /> : s.isPlatform ? <StatusBadge status="ACTIVE" /> : <Select aria-label={`Status of ${s.name}`} className="h-8 w-32 text-xs" value={s.status} onChange={(e) => setStatusOf.mutate({ id: s.id, status: e.target.value })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></Select>}</Td>
                <Td className="whitespace-nowrap text-right">
                  {!s.deletedAt && !s.isPlatform && <>
                    <Button variant="ghost" size="icon" aria-label={`View ${s.name} data`} title="Switch to this supplier" onClick={() => { setScopeSupplier(s.id); nav('/'); }}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Create admin for ${s.name}`} title="Create supplier admin" onClick={() => { setAdminFor(s); setAdmErr(null); }}><UserPlus className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Upload logo for ${s.name}`} title="Upload logo" onClick={() => { setLogoFor(s.id); logo.current?.click(); }}><ImageUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => open(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${s.name}`} onClick={() => setDel(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button></>}
                  {s.deletedAt && <Button variant="ghost" size="icon" aria-label={`Restore ${s.name}`} onClick={() => restore.mutate(s.id)}><RotateCcw className="h-4 w-4" /></Button>}
                </Td>
              </tr>))}</tbody></Table>
        )}
        {(list.data?.meta?.total ?? 0) > 0 && <div className="border-t px-3"><Pagination page={page} limit={LIMIT} total={list.data!.meta!.total} onPage={setPage} /></div>}
      </Card>
      <input ref={logo} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Logo file" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }} />

      <Modal open={!!form} onClose={() => setForm(null)} wide title={form?.row ? 'Edit supplier' : 'New supplier'} footer={<><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" form="supplier-form" loading={busy}>{form?.row ? 'Save changes' : 'Create'}</Button></>}>
        <form id="supplier-form" onSubmit={save} className="space-y-4" noValidate>
          {top && <p role="alert" className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">{top}</p>}
          {!form?.row && <p className="text-xs text-muted-foreground">The supplier code (SUP-0001 style) is generated automatically.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {([['name', 'Name', true], ['legalName', 'Legal name'], ['email', 'Email', true], ['phone', 'Phone'], ['taxId', 'Tax ID'], ['commissionPct', 'Commission %']] as const).map(([k, label, req]) => (
              <Field key={k} label={label} required={!!req} error={errs[k]}>{(id, inv) => <Input id={id} aria-invalid={inv} value={st[k]} inputMode={k === 'commissionPct' ? 'decimal' : undefined} onChange={(e) => setSt((p) => ({ ...p, [k]: e.target.value }))} />}</Field>))}
            <Field label="Country" error={errs.countryCode}>{(id, inv) => <RefSelectCountry id={id} inv={inv} value={st.countryCode} onChange={(v) => setSt((p) => ({ ...p, countryCode: v }))} />}</Field>
            <Field label="Status">{(id) => <Select id={id} value={st.status} onChange={(e) => setSt((p) => ({ ...p, status: e.target.value }))}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></Select>}</Field>
            <div className="sm:col-span-2"><Field label="Address" error={errs.address}>{(id) => <Textarea id={id} rows={2} value={st.address} onChange={(e) => setSt((p) => ({ ...p, address: e.target.value }))} />}</Field></div>
          </div>
        </form>
      </Modal>

      <Modal open={!!adminFor} onClose={() => setAdminFor(null)} title={`Create admin for ${adminFor?.name ?? ''}`} footer={<><Button variant="outline" onClick={() => setAdminFor(null)}>Cancel</Button><Button type="submit" form="admin-form" loading={busy}>Create admin</Button></>}>
        <form id="admin-form" onSubmit={createAdmin} className="space-y-4">
          {admErr && !admErr.errors?.length && <p role="alert" className="text-sm text-destructive">{admErr.message}</p>}
          <Field label="Full name" required error={admErr?.errors?.find((x) => x.field === 'name')?.message}>{(id, inv) => <Input id={id} aria-invalid={inv} value={adm.name} onChange={(e) => setAdm({ ...adm, name: e.target.value })} />}</Field>
          <Field label="Email" required error={admErr?.errors?.find((x) => x.field === 'email')?.message}>{(id, inv) => <Input id={id} aria-invalid={inv} type="email" value={adm.email} onChange={(e) => setAdm({ ...adm, email: e.target.value })} />}</Field>
          <p className="text-xs text-muted-foreground">A temporary password is generated and shown once.</p>
        </form>
      </Modal>
      {secret && <SecretBox title="Temporary password" secret={secret} onClose={() => setSecret(null)} />}
      <ConfirmDialog open={!!del} danger title="Delete supplier?" confirmLabel="Delete" loading={remove.isPending} message={<>“{del?.name}” and its users will no longer be able to sign in. Their data is kept and you can restore the supplier later.</>} onCancel={() => setDel(null)} onConfirm={() => remove.mutate(del.id)} />
    </div>
  );
}

function RefSelectCountry({ id, inv, value, onChange }: { id: string; inv: boolean; value: string; onChange: (v: string) => void }) {
  const q = useQuery({ queryKey: ['codeopts', 'countries'], staleTime: 600_000, queryFn: () => api<any[]>('/shared/countries', { query: { limit: 100, sort: 'name:asc' } }) });
  void RefSelect; void countryField;
  return <Select id={id} aria-invalid={inv} value={value} onChange={(e) => onChange(e.target.value)}><option value="">— none —</option>{q.data?.data.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select>;
}

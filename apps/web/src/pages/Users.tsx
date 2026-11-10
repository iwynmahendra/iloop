import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Pagination, Select, Spinner, StatusBadge, Table, Td, Th } from '@/components/ui';
import { useDebounced } from '@/hooks/useDebounced';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, humanize } from '@/lib/utils';

const LIMIT = 20;
export default function Users() {
  const { user: me, scopeSupplier } = useAuth(); const qc = useQueryClient(); const isSuper = me?.role === 'SUPER_ADMIN';
  const [page, setPage] = useState(1); const [q, setQ] = useState(''); const dq = useDebounced(q); const [role, setRole] = useState('');
  const list = useQuery({ queryKey: ['users', page, dq, role, scopeSupplier], queryFn: () => api<any[]>('/users', { query: { page, limit: LIMIT, q: dq, role } }), placeholderData: (p) => p });
  const sup = useQuery({ queryKey: ['suppliers', 'switcher'], enabled: isSuper, queryFn: () => api<any[]>('/suppliers', { query: { limit: 100, sort: 'name:asc' } }) });
  const [form, setForm] = useState<{ row: any | null } | null>(null);
  const [st, setSt] = useState({ name: '', email: '', role: 'SUPPLIER_STAFF', supplierId: '', status: 'ACTIVE' }); const [err, setErr] = useState<ApiError | null>(null); const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null); const [del, setDel] = useState<any | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });
  const open = (row: any | null) => { setForm({ row }); setErr(null); setSt(row ? { name: row.name, email: row.email, role: row.role, supplierId: row.supplierId ?? '', status: row.status } : { name: '', email: '', role: 'SUPPLIER_STAFF', supplierId: scopeSupplier ?? '', status: 'ACTIVE' }); };
  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      if (form?.row) await api(`/users/${form.row.id}`, { method: 'PATCH', body: { name: st.name, ...(form.row.role !== 'SUPER_ADMIN' ? { role: st.role } : {}), status: st.status } });
      else { const r = await api<any>('/users', { method: 'POST', body: { name: st.name, email: st.email, role: st.role, ...(isSuper && st.role !== 'SUPER_ADMIN' ? { supplierId: st.supplierId || undefined } : {}) } }); setSecret(r.data.temporaryPassword); }
      toast.success(form?.row ? 'User updated' : 'User created'); setForm(null); refresh();
    } catch (x) { setErr(x as ApiError); } finally { setBusy(false); }
  };
  const reset = useMutation({ mutationFn: (id: string) => api<any>(`/users/${id}/reset-password`, { method: 'POST' }), onSuccess: (r) => { setSecret(r.data.temporaryPassword); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: (id: string) => api(`/users/${id}`, { method: 'DELETE' }), onSuccess: () => { toast.success('User deleted'); setDel(null); refresh(); }, onError: (e: Error) => { toast.error(e.message); setDel(null); } });
  const fe = (f: string) => err?.errors?.find((x) => x.field === f)?.message;
  const rows = list.data?.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-semibold">Users</h1><Button size="sm" onClick={() => open(null)}><Plus className="h-4 w-4" />New user</Button></div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-8" aria-label="Search" placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Select aria-label="Role" className="w-44" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">All roles</option>{isSuper && <option value="SUPER_ADMIN">Super admin</option>}<option value="SUPPLIER_ADMIN">Supplier admin</option><option value="SUPPLIER_STAFF">Supplier staff</option></Select>
        </div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} /> : rows.length === 0 ? <EmptyState title="No users found" /> : (
          <Table><thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th>{isSuper && <Th>Supplier</Th>}<Th>Status</Th><Th>Last sign-in</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>{rows.map((u) => { const self = u.id === me?.id; return (
              <tr key={u.id} className="hover:bg-muted/40">
                <Td className="font-medium">{u.name}{self && <Badge className="ml-2" tone="info">You</Badge>}</Td><Td>{u.email}</Td><Td><Badge>{humanize(u.role)}</Badge></Td>
                {isSuper && <Td className="text-xs">{u.supplierId ? sup.data?.data.find((s) => s.id === u.supplierId)?.code ?? '…' : '—'}</Td>}
                <Td><StatusBadge status={u.status} /></Td><Td className="text-xs text-muted-foreground">{u.lastLoginAt ? fmtDate(u.lastLoginAt, true) : 'Never'}</Td>
                <Td className="whitespace-nowrap text-right">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${u.name}`} onClick={() => open(u)}><Pencil className="h-4 w-4" /></Button>
                  {!self && <><Button variant="ghost" size="icon" aria-label={`Reset password for ${u.name}`} title="Reset password" onClick={() => reset.mutate(u.id)}><KeyRound className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${u.name}`} onClick={() => setDel(u)}><Trash2 className="h-4 w-4 text-destructive" /></Button></>}
                </Td>
              </tr>); })}</tbody></Table>
        )}
        {(list.data?.meta?.total ?? 0) > 0 && <div className="border-t px-3"><Pagination page={page} limit={LIMIT} total={list.data!.meta!.total} onPage={setPage} /></div>}
      </Card>
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.row ? 'Edit user' : 'New user'} footer={<><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" form="user-form" loading={busy}>{form?.row ? 'Save changes' : 'Create'}</Button></>}>
        <form id="user-form" onSubmit={save} className="space-y-4">
          {err && !err.errors?.length && <p role="alert" className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">{err.message}</p>}
          <Field label="Full name" required error={fe('name')}>{(id, inv) => <Input id={id} aria-invalid={inv} value={st.name} onChange={(e) => setSt({ ...st, name: e.target.value })} />}</Field>
          <Field label="Email" required error={fe('email')}>{(id, inv) => <Input id={id} aria-invalid={inv} type="email" disabled={!!form?.row} value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />}</Field>
          <Field label="Role" hint="Staff can create and edit but not delete.">{(id) => <Select id={id} disabled={form?.row?.role === 'SUPER_ADMIN' || form?.row?.id === me?.id} value={st.role} onChange={(e) => setSt({ ...st, role: e.target.value })}>{isSuper && <option value="SUPER_ADMIN">Super admin</option>}<option value="SUPPLIER_ADMIN">Supplier admin</option><option value="SUPPLIER_STAFF">Supplier staff</option></Select>}</Field>
          {isSuper && !form?.row && st.role !== 'SUPER_ADMIN' && <Field label="Supplier" required>{(id) => <Select id={id} value={st.supplierId} onChange={(e) => setSt({ ...st, supplierId: e.target.value })}><option value="">— choose —</option>{sup.data?.data.filter((s) => !s.isPlatform).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</Select>}</Field>}
          {form?.row && <Field label="Status">{(id) => <Select id={id} disabled={form.row.id === me?.id} value={st.status} onChange={(e) => setSt({ ...st, status: e.target.value })}><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option></Select>}</Field>}
          {!form?.row && <p className="text-xs text-muted-foreground">A temporary password is generated and shown once.</p>}
        </form>
      </Modal>
      {secret && <Modal open onClose={() => setSecret(null)} title="Temporary password" footer={<Button onClick={() => setSecret(null)}>Done</Button>}><p className="text-sm">Share this securely. <b>It is shown only once</b>; the user must change it at first sign-in.</p><code className="mt-3 block select-all rounded bg-muted px-3 py-2 text-sm">{secret}</code></Modal>}
      <ConfirmDialog open={!!del} danger title="Delete user?" confirmLabel="Delete" loading={remove.isPending} message={<>“{del?.name}” will be signed out and can no longer sign in.</>} onCancel={() => setDel(null)} onConfirm={() => remove.mutate(del.id)} />
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Card, EmptyState, ErrorState, Input, Pagination, Select, Spinner, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, humanize } from '@/lib/utils';

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'ACTIVATE', 'DEACTIVATE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET', 'IMPORT', 'EXPORT'];
const LIMIT = 25;

function Diff({ before, after }: { before: any; after: any }) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])).filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]) || !before || !after);
  const show = (v: unknown) => v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {(['Before', 'After'] as const).map((t) => {
        const o = t === 'Before' ? before : after;
        return <div key={t}><h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t}</h4>{!o ? <p className="text-xs text-muted-foreground">—</p> : (
          <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{keys.map((k) => { const changed = before && after && JSON.stringify(before[k]) !== JSON.stringify(after[k]); return <div key={k} className={changed ? 'bg-warning/20' : ''}>{k}: {show(o[k])}</div>; })}</pre>)}</div>;
      })}
    </div>
  );
}

export default function AuditLog() {
  const { user, scopeSupplier } = useAuth();
  const [sp, setSp] = useSearchParams(); const [open, setOpen] = useState<string | null>(null);
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); return n; }, { replace: true });
  const params = { page, limit: LIMIT, entityType: sp.get('entityType') || undefined, entityId: sp.get('entityId') || undefined, action: sp.get('action') || undefined,
    from: sp.get('from') ? new Date(sp.get('from')!).toISOString() : undefined, to: sp.get('to') ? new Date(sp.get('to')! + 'T23:59:59').toISOString() : undefined };
  const q = useQuery({ queryKey: ['audit', params, scopeSupplier], queryFn: () => api<any[]>('/audit-logs', { query: params }), placeholderData: (p) => p });
  const rows = q.data?.data ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit log</h1>
      <Card>
        <div className="flex flex-wrap items-end gap-2 border-b p-3">
          <Select aria-label="Action" className="w-40" value={sp.get('action') ?? ''} onChange={(e) => set('action', e.target.value)}><option value="">All actions</option>{ACTIONS.map((a) => <option key={a} value={a}>{humanize(a)}</option>)}</Select>
          <Input aria-label="Entity type" className="w-44" placeholder="Entity, e.g. Hotel" value={sp.get('entityType') ?? ''} onChange={(e) => set('entityType', e.target.value)} />
          <label className="flex items-center gap-1 text-xs text-muted-foreground">From<Input type="date" className="w-40" value={sp.get('from') ?? ''} onChange={(e) => set('from', e.target.value)} /></label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">To<Input type="date" className="w-40" value={sp.get('to') ?? ''} onChange={(e) => set('to', e.target.value)} /></label>
          {sp.get('entityId') && <Badge tone="info" className="cursor-pointer" onClick={() => set('entityId', '')}>One record ✕</Badge>}
        </div>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : rows.length === 0 ? <EmptyState title="No audit entries match" /> : (
          <Table><thead><tr><Th className="w-8" /><Th>When</Th><Th>Action</Th><Th>Entity</Th><Th>User</Th>{user?.role === 'SUPER_ADMIN' && <Th>IP</Th>}</tr></thead>
            <tbody>{rows.map((r) => (
              <Fragment key={r.id}>
                <tr className="hover:bg-muted/40">
                  <Td><button type="button" aria-expanded={open === r.id} aria-label="Show details" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></Td>
                  <Td className="whitespace-nowrap tabular-nums">{fmtDate(r.createdAt, true)}</Td>
                  <Td><Badge tone={r.action === 'DELETE' || r.action === 'LOGIN_FAILED' ? 'danger' : r.action === 'CREATE' ? 'success' : 'neutral'}>{humanize(r.action)}</Badge></Td>
                  <Td>{r.entityType}{r.entityId && <span className="ml-1 font-mono text-xs text-muted-foreground">{r.entityId.slice(0, 8)}</span>}</Td>
                  <Td>{r.userEmail ?? <span className="text-muted-foreground">system</span>}</Td>
                  {user?.role === 'SUPER_ADMIN' && <Td className="text-xs text-muted-foreground">{r.ip}</Td>}
                </tr>
                {open === r.id && <tr><Td colSpan={6} className="bg-muted/30"><Diff before={r.before} after={r.after} /></Td></tr>}
              </Fragment>))}</tbody></Table>
        )}
        {(q.data?.meta?.total ?? 0) > 0 && <div className="border-t px-3"><Pagination page={page} limit={LIMIT} total={q.data!.meta!.total} onPage={(p) => set('page', String(p))} /></div>}
      </Card>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ResourceDef } from '@/generated/resources';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, humanize } from '@/lib/utils';
import { CellValue } from './fields';
import { SetSection } from './SetEditors';
import { Badge, Button, ErrorState, Modal, Spinner, StatusBadge } from './ui';

export default function ResourceDetail({ def, id, onClose, onEdit, canWrite }: { def: ResourceDef; id: string | null; onClose: () => void; onEdit: (row: any) => void; canWrite: boolean }) {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['detail', def.path, id], enabled: !!id, queryFn: () => api<any>(`/${def.group}/${def.path}/${id}`) });
  const hist = useQuery({ queryKey: ['history', def.name, id], enabled: !!id && can.audit, queryFn: () => api<any[]>('/audit-logs', { query: { entityType: def.name, entityId: id, limit: 8 } }) });
  const row = q.data?.data;
  const title = row ? `${def.label}: ${(def.display && row[def.display]) ?? ''}` : def.label;
  return (
    <Modal open={!!id} onClose={onClose} title={title} side footer={canWrite && row && !row.deletedAt ? <Button onClick={() => onEdit(row)}>Edit</Button> : undefined}>
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : row && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={row.status} deleted={!!row.deletedAt} /><span className="text-xs text-muted-foreground">Updated {fmtDate(row.updatedAt, true)}</span></div>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            {def.fields.filter((f) => f.n !== 'status').map((f) => (
              <div key={f.n} className={f.t === 'json' || f.t === 'array' || (f.t === 'string' && !f.max) ? 'sm:col-span-2' : ''}>
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="mt-0.5 break-words text-sm">
                  {f.t === 'array' && row[f.n]?.length ? <ul className="list-disc pl-4">{row[f.n].map((x: string) => <li key={x}>{x}</li>)}</ul>
                    : f.t === 'json' && row[f.n] ? <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(row[f.n], null, 2)}</pre>
                    : f.t === 'string' && !f.max && row[f.n] ? <p className="whitespace-pre-wrap">{row[f.n]}</p> : <CellValue f={f} row={row} />}
                </dd>
              </div>
            ))}
          </dl>
          {def.sets.map((s) => (
            <section key={s.path}><h3 className="mb-2 text-sm font-semibold">{s.path === 'images' ? 'Gallery' : 'Amenities'}</h3>
              <SetSection def={def} set={s} id={row.id} items={row[s.path] ?? []} canWrite={canWrite && !row.deletedAt} /></section>
          ))}
          {def.children.length > 0 && (
            <section><h3 className="mb-2 text-sm font-semibold">Related</h3>
              <div className="flex flex-wrap gap-2">{def.children.map((c) => <Link key={c.path} to={`/${c.group}/${c.path}?${c.field}=${row.id}`} onClick={onClose}><Badge tone="info" className="px-3 py-1 text-sm">{c.label} →</Badge></Link>)}</div></section>
          )}
          {can.audit && (
            <section><h3 className="mb-2 text-sm font-semibold">History</h3>
              {hist.isLoading ? <Spinner /> : !hist.data?.data.length ? <p className="text-sm text-muted-foreground">No recorded changes.</p> : (
                <ul className="space-y-1 text-sm">{hist.data.data.map((h) => <li key={h.id} className="flex justify-between gap-2"><span><Badge>{humanize(h.action)}</Badge> <span className="text-muted-foreground">{h.userEmail ?? 'system'}</span></span><span className="text-xs text-muted-foreground">{fmtDate(h.createdAt, true)}</span></li>)}</ul>
              )}
              <Link to={`/audit-logs?entityId=${row.id}`} className="mt-2 inline-block text-xs text-primary hover:underline" onClick={onClose}>Full history with before/after →</Link>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

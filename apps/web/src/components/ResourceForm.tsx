import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ResourceDef } from '@/generated/resources';
import { api, ApiError } from '@/lib/api';
import { emptyState, FieldInput, fromRow, toBody, type FormState } from './fields';
import { Button, Modal } from './ui';

export default function ResourceForm({ def, open, row, prefill, onClose, onSaved }: { def: ResourceDef; open: boolean; row: any | null; prefill?: Record<string, string>; onClose: () => void; onSaved: (saved: any) => void }) {
  const qc = useQueryClient();
  const editing = !!row;
  const [st, setSt] = useState<FormState>({}); const [initial, setInitial] = useState<FormState>({});
  const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [top, setTop] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const s = editing ? fromRow(def, row) : emptyState(def, prefill);
    setSt(s); setInitial(s); setErrs({}); setTop(null);
  }, [open, row, def]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTop(null);
    const { body, errors } = toBody(def, st, editing ? initial : undefined);
    if (Object.keys(errors).length) { setErrs(errors); return; }
    if (editing && !Object.keys(body).length) { onClose(); return; }
    setBusy(true); setErrs({});
    try {
      const r = await api<any>(`/${def.group}/${def.path}${editing ? `/${row.id}` : ''}`, { method: editing ? 'PATCH' : 'POST', body });
      toast.success(editing ? `${def.label} updated` : `${def.label} created`);
      qc.invalidateQueries({ queryKey: ['list', def.path] }); qc.invalidateQueries({ queryKey: ['detail', def.path] }); qc.invalidateQueries({ queryKey: ['refopts', def.path] }); qc.invalidateQueries({ queryKey: ['ref', def.path] }); qc.invalidateQueries({ queryKey: ['dashboard'] });
      onSaved(r.data);
    } catch (x) {
      const err = x as ApiError;
      if (err.errors?.length) {
        const m: Record<string, string> = {}; const extra: string[] = [];
        err.errors.forEach((i: any) => { if (i.field && def.fields.some((f) => f.n === i.field)) m[i.field] = i.message; else extra.push(i.field ? `${i.field}: ${i.message}` : i.constraint ? `Rule: ${i.constraint}` : i.message); });
        setErrs(m); setTop(extra.length ? `${err.message} (${extra.join('; ')})` : Object.keys(m).length ? 'Please fix the highlighted fields.' : err.message);
      } else setTop(err.message);
    } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} wide title={editing ? `Edit ${def.label.toLowerCase()}` : `New ${def.label.toLowerCase()}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="resource-form" loading={busy}>{editing ? 'Save changes' : 'Create'}</Button></>}>
      <form id="resource-form" onSubmit={submit} className="space-y-4" noValidate>
        {top && <p role="alert" className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">{top}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {def.fields.map((f) => (
            <div key={f.n} className={f.t === 'json' || f.t === 'array' || (f.t === 'string' && !f.max) ? 'sm:col-span-2' : ''}>
              <FieldInput f={f} value={st[f.n] ?? ''} onChange={(v) => setSt((p) => ({ ...p, [f.n]: v }))} error={errs[f.n]} />
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}

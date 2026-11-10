import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, Field, Input } from '../components/ui';
import { api, ApiError, setAccessToken } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Account() {
  const { user, setUser } = useAuth(); const nav = useNavigate(); const [sp] = useSearchParams();
  const [cur, setCur] = useState(''); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<ApiError | null>(null);
  const forced = sp.get('force') === '1' || user?.mustChangePassword;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api('/auth/change-password', { method: 'POST', body: { currentPassword: cur, newPassword: pw } }); toast.success('Password changed. Please sign in again.'); setAccessToken(null); setUser(null); nav('/login'); }
    catch (x) { setErr(x as ApiError); } finally { setBusy(false); }
  };
  const fe = (f: string) => err?.errors?.find((x) => x.field === f)?.message;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Account</h1>
      <Card className="space-y-1 p-4 text-sm"><p><b>{user?.name}</b></p><p>{user?.email}</p><p className="text-muted-foreground">{user?.role.replace('_', ' ').toLowerCase()}{user?.supplier ? ` · ${user.supplier.code} ${user.supplier.name}` : ''}</p></Card>
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Change password</h2>
        {forced && <p role="alert" className="mb-3 rounded-md bg-warning/10 p-2.5 text-sm">You are using a temporary password. Please choose a new one to continue.</p>}
        <form onSubmit={submit} className="space-y-4">
          {err && !err.errors?.length && <p role="alert" className="text-sm text-destructive">{err.message}</p>}
          <Field label="Current password" required>{(id) => <Input id={id} type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />}</Field>
          <Field label="New password" hint="At least 10 characters, with a letter and a number." error={fe('newPassword')} required>{(id, inv) => <Input id={id} aria-invalid={inv} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />}</Field>
          <Button type="submit" loading={busy}>Change password</Button>
        </form>
      </Card>
    </div>
  );
}

import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, Field, Input } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </Card>
    </div>
  );
}
const fieldErr = (e: unknown, f: string) => (e instanceof ApiError ? e.errors?.find((x) => x.field === f)?.message : undefined);

export function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  if (user) return <Navigate to="/" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const u = await login(email, password); nav(u.mustChangePassword ? '/account?force=1' : '/', { replace: true }); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Sign in" subtitle="Booking platform master data">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <p role="alert" className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">{err}</p>}
        <Field label="Email" required>{(id) => <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}</Field>
        <Field label="Password" required>{(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}</Field>
        <Button type="submit" className="w-full" loading={busy}>Sign in</Button>
        <p className="text-center text-sm"><Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link></p>
      </form>
    </Shell>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { await api('/auth/forgot-password', { method: 'POST', body: { email } }); setSent(true); } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); } };
  return (
    <Shell title="Reset your password" subtitle="We will email you a link that works for 30 minutes.">
      {sent ? <p role="status" className="text-sm">If that email exists, a reset link has been sent. <Link to="/login" className="text-primary hover:underline">Back to sign in</Link></p> : (
        <form onSubmit={submit} className="space-y-4"><Field label="Email" required>{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}</Field>
          <Button type="submit" className="w-full" loading={busy}>Send reset link</Button><p className="text-center text-sm"><Link to="/login" className="text-primary hover:underline">Back to sign in</Link></p></form>
      )}
    </Shell>
  );
}

export function ResetPage() {
  const [sp] = useSearchParams(); const nav = useNavigate();
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api('/auth/reset-password', { method: 'POST', body: { token: sp.get('token') ?? '', password } }); toast.success('Password updated. Please sign in.'); nav('/login'); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <Shell title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        {err instanceof Error && !fieldErr(err, 'password') && <p role="alert" className="text-sm text-destructive">{err.message}</p>}
        <Field label="New password" hint="At least 10 characters, with a letter and a number." error={fieldErr(err, 'password')} required>{(id, inv) => <Input id={id} aria-invalid={inv} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />}</Field>
        <Button type="submit" className="w-full" loading={busy}>Update password</Button>
      </form>
    </Shell>
  );
}

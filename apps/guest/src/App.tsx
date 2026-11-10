import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, call, getToken, setOnExpired, setToken } from './api';

type Me = { bookingNo: string; guestName: string; room: string | null; dnd: boolean; checkIn: string; checkOut: string; nights: number; hotel: { name: string; address?: string | null; contactPhone?: string | null; contactEmail?: string | null; checkInTime?: string | null }; total: string | number; paid: string | number; balance: number };
type Field = { label: string; type: 'select' | 'text' | 'time'; options?: string[] };
type Service = { key: string; icon: string; name: string; fields: Field[]; flow: string[] };
type Req = { ref: string; service: string; createdAt: string; status: string; flow: string[]; step: number; note?: string | null };
type Item = { id: string; category: string; name: string; description?: string | null; price: string | number };
type Order = { ref: string; items: { name: string; qty: number; price: number }[]; total: string | number; status: string; createdAt: string; deliverWhen: string };
type Msg = { role: 'user' | 'assistant'; content: string; sources?: string[]; mode?: string };

const d = (s: string) => new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const money = (n: string | number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(n));
const ORDER_FLOW = ['NEW', 'PREPARING', 'ON_THE_WAY', 'DELIVERED'];
const ORDER_LABEL: Record<string, string> = { NEW: 'Order received', PREPARING: 'Being prepared', ON_THE_WAY: 'On the way', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' };
const LANGS: [string, string][] = [['', 'Auto'], ['en-US', 'English'], ['id-ID', 'Bahasa Indonesia'], ['zh-CN', '中文'], ['ja-JP', '日本語'], ['ko-KR', '한국어'], ['es-ES', 'Español'], ['fr-FR', 'Français'], ['de-DE', 'Deutsch'], ['ru-RU', 'Русский'], ['ar-SA', 'العربية']];

function useAsync<T>(path: string | null, deps: unknown[] = []) {
  const [data, set] = useState<T | null>(null); const [err, setErr] = useState(''); const [loading, setL] = useState(!!path);
  const load = useCallback(async () => { if (!path) return; try { set(await call<T>(path)); setErr(''); } catch (e) { setErr((e as Error).message); } finally { setL(false); } }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, err, loading, reload: load };
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [bookingNo, setB] = useState(''); const [lastName, setL] = useState(''); const [email, setE] = useState(''); const [needEmail, setNeed] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await call<{ token: string }>('/auth', { method: 'POST', body: { bookingNo: bookingNo.trim(), lastName: lastName.trim(), ...(email.trim() ? { email: email.trim() } : {}) } }); setToken(r.token); onDone(); }
    catch (x) { if ((x as ApiError).status === 409) setNeed(true); setErr((x as Error).message); } finally { setBusy(false); }
  }
  return <main className="signin"><div className="brand">Guest concierge</div><h1>Welcome</h1><p className="muted">Sign in with your booking number and last name to order, ask for help or find out about the hotel.</p>
    <form onSubmit={go} className="stack">
      <label>Booking number<input autoFocus autoComplete="off" autoCapitalize="characters" value={bookingNo} onChange={(e) => setB(e.target.value)} placeholder="e.g. BK-2611-AB12" required minLength={4} /></label>
      <label>Last name<input autoComplete="family-name" value={lastName} onChange={(e) => setL(e.target.value)} required minLength={2} /></label>
      {needEmail && <label>Email used for the booking<input type="email" autoComplete="email" value={email} onChange={(e) => setE(e.target.value)} required /></label>}
      {err && <p role="alert" className="error">{err}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
    </form><p className="muted small">Your booking number is in your confirmation email. Sign-in works from the day before you arrive until you check out.</p></main>;
}

function Steps({ flow, step, cancelled }: { flow: string[]; step: number; cancelled?: boolean }) {
  return <ol className="steps" aria-label="Progress">{flow.map((s, i) => <li key={s} className={cancelled ? 'off' : i < step ? 'done' : i === step ? 'now' : ''} aria-current={i === step ? 'step' : undefined}>{s}</li>)}</ol>;
}

function Home({ me, go, reqs }: { me: Me; go: (t: Tab) => void; reqs: Req[] }) {
  const [dnd, setDnd] = useState(me.dnd); const [err, setErr] = useState('');
  const open = reqs.filter((r) => r.status !== 'DONE');
  async function toggle() { const n = !dnd; setDnd(n); try { await call('/dnd', { method: 'PATCH', body: { dnd: n } }); } catch (e) { setDnd(!n); setErr((e as Error).message); } }
  return <div className="stack">
    <section className="card hero"><p className="muted small">{me.hotel.name}</p><h2>Hello, {me.guestName.split(' ')[0]}</h2><p>{me.room ? <>Room <b>{me.room}</b></> : 'Your room will be shown here once you check in'} · {d(me.checkIn)} to {d(me.checkOut)} ({me.nights} night{me.nights === 1 ? '' : 's'})</p></section>
    <div className="grid2"><button className="tile" onClick={() => go('services')}><span aria-hidden>🛎️</span>Request a service</button><button className="tile" onClick={() => go('dining')}><span aria-hidden>🍽️</span>Room dining</button><button className="tile" onClick={() => go('chat')}><span aria-hidden>💬</span>Ask the assistant</button><button className="tile" onClick={() => go('stay')}><span aria-hidden>🏨</span>My stay</button></div>
    {open.length > 0 && <section className="card"><h3>Your open requests</h3>{open.slice(0, 3).map((r) => <div key={r.ref} className="req"><b>{r.service}</b><Steps flow={r.flow} step={r.step} /></div>)}{open.length > 3 && <button className="link" onClick={() => go('services')}>See all {open.length}</button>}</section>}
    <section className="card row"><div><h3>Do not disturb</h3><p className="muted small">Housekeeping will skip your room.</p></div><label className="switch"><input type="checkbox" role="switch" checked={dnd} disabled={!me.room} onChange={toggle} aria-label="Do not disturb" /><span /></label></section>
    {err && <p role="alert" className="error">{err}</p>}
  </div>;
}

function Services({ me, reqs, reload }: { me: Me; reqs: Req[]; reload: () => void }) {
  const sv = useAsync<Service[]>('/services'); const [sel, setSel] = useState<Service | null>(null); const [ans, setAns] = useState<Record<string, string>>({}); const [urgent, setUrgent] = useState(false); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  function pick(s: Service) { setSel(s); setUrgent(false); setErr(''); setMsg(''); setAns(Object.fromEntries(s.fields.filter((f) => f.type === 'select').map((f) => [f.label, f.options![0]!]))); }
  async function send(e: React.FormEvent) {
    e.preventDefault(); if (!sel) return; setBusy(true); setErr('');
    try { const clean = Object.fromEntries(Object.entries(ans).filter(([, v]) => v.trim())); await call('/requests', { method: 'POST', body: { service: sel.key, answers: clean, urgent } }); setMsg(`${sel.name} requested. We will keep you updated below.`); setSel(null); reload(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return <div className="stack">
    {!me.room && <p className="notice">Requests need a room number. Please check in at the front desk first.</p>}
    {msg && <p role="status" className="ok">{msg}</p>}
    {sel ? <form className="card stack" onSubmit={send}><h3><span aria-hidden>{sel.icon}</span> {sel.name}</h3>
      {sel.fields.map((f) => <label key={f.label}>{f.label}{f.type === 'select' ? <select value={ans[f.label] ?? ''} onChange={(e) => setAns({ ...ans, [f.label]: e.target.value })}>{f.options!.map((o) => <option key={o}>{o}</option>)}</select> : <input type={f.type === 'time' ? 'time' : 'text'} maxLength={300} value={ans[f.label] ?? ''} onChange={(e) => setAns({ ...ans, [f.label]: e.target.value })} />}</label>)}
      <label className="check"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />This is urgent</label>
      {err && <p role="alert" className="error">{err}</p>}
      <div className="row"><button type="button" onClick={() => setSel(null)}>Back</button><button className="primary" disabled={busy || !me.room}>{busy ? 'Sending…' : 'Send request'}</button></div></form>
    : <>{sv.loading ? <p className="muted">Loading…</p> : sv.err ? <p role="alert" className="error">{sv.err}</p> : <div className="grid2">{sv.data?.map((s) => <button key={s.key} className="tile" onClick={() => pick(s)}><span aria-hidden>{s.icon}</span>{s.name}</button>)}</div>}
      <h3>Your requests</h3>{!reqs.length ? <p className="muted">Nothing yet.</p> : reqs.map((r) => <section key={r.ref} className="card req"><div className="row"><b>{r.service}</b><span className="muted small">{r.ref}</span></div><Steps flow={r.flow} step={r.step} /></section>)}</>}
  </div>;
}

function Dining({ me }: { me: Me }) {
  const menu = useAsync<Item[]>('/menu'); const orders = useAsync<Order[]>('/orders');
  const [cart, setCart] = useState<Record<string, number>>({}); const [note, setNote] = useState(''); const [when, setWhen] = useState('ASAP'); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  useEffect(() => { const t = setInterval(() => void orders.reload(), 20000); return () => clearInterval(t); }, [orders.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = menu.data ?? []; const lines = items.filter((i) => cart[i.id]); const total = lines.reduce((a, i) => a + cart[i.id]! * Number(i.price), 0);
  const cats = [...new Set(items.map((i) => i.category))];
  const bump = (id: string, n: number) => setCart((c) => { const q = Math.max(0, Math.min(20, (c[id] ?? 0) + n)); const x = { ...c }; if (q) x[id] = q; else delete x[id]; return x; });
  async function order() {
    setBusy(true); setErr(''); setOk('');
    try { const r = await call<{ ref: string }>('/orders', { method: 'POST', body: { items: lines.map((i) => ({ id: i.id, qty: cart[i.id] })), note: note.trim() || undefined, when } }); setOk(`Order ${r.ref} sent to the kitchen.`); setCart({}); setNote(''); void orders.reload(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return <div className="stack">
    {!me.room && <p className="notice">Orders need a room number. Please check in at the front desk first.</p>}
    {ok && <p role="status" className="ok">{ok}</p>}
    {orders.data?.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status)).map((o) => <section key={o.ref} className="card"><div className="row"><b>{o.ref}</b><span className="muted small">{money(o.total)}</span></div><Steps flow={ORDER_FLOW.map((s) => ORDER_LABEL[s]!)} step={ORDER_FLOW.indexOf(o.status)} /></section>)}
    {menu.loading ? <p className="muted">Loading menu…</p> : menu.err ? <p role="alert" className="error">{menu.err}</p> : !items.length ? <p className="muted">Room dining is not available right now.</p> : cats.map((c) => <section key={c} className="card"><h3>{c}</h3>{items.filter((i) => i.category === c).map((i) => <div key={i.id} className="item"><div><b>{i.name}</b>{i.description && <p className="muted small">{i.description}</p>}<span className="small">{money(i.price)}</span></div>
      <div className="qty"><button aria-label={`Remove one ${i.name}`} onClick={() => bump(i.id, -1)} disabled={!cart[i.id]}>−</button><span aria-live="polite">{cart[i.id] ?? 0}</span><button aria-label={`Add one ${i.name}`} onClick={() => bump(i.id, 1)}>+</button></div></div>)}</section>)}
    {lines.length > 0 && <section className="card stack cart"><h3>Your order</h3>{lines.map((i) => <div key={i.id} className="row"><span>{cart[i.id]} × {i.name}</span><span>{money(cart[i.id]! * Number(i.price))}</span></div>)}
      <label>Deliver<select value={when} onChange={(e) => setWhen(e.target.value)}><option>ASAP</option><option>In 30 minutes</option><option>In 1 hour</option></select></label>
      <label>Note for the kitchen<input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Allergies, no ice, …" /></label>
      {err && <p role="alert" className="error">{err}</p>}
      <button className="primary" onClick={order} disabled={busy || !me.room}>{busy ? 'Sending…' : `Order · ${money(total)}`}</button><p className="muted small">Charged to your room. Prices are confirmed by the hotel.</p></section>}
    {(orders.data?.filter((o) => ['DELIVERED', 'CANCELLED'].includes(o.status)).length ?? 0) > 0 && <><h3>Past orders</h3>{orders.data!.filter((o) => ['DELIVERED', 'CANCELLED'].includes(o.status)).map((o) => <section key={o.ref} className="card small"><div className="row"><b>{o.ref}</b><span>{ORDER_LABEL[o.status]}</span></div><p className="muted">{o.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</p></section>)}</>}
  </div>;
}

function Stay({ me, onOut }: { me: Me; onOut: () => void }) {
  const bk = useAsync<{ bookingNo: string; product: string; status: string; startAt: string; totalAmount: string; paidAmount: string; currencyCode: string }[]>('/bookings');
  return <div className="stack">
    <section className="card"><h3>{me.hotel.name}</h3><dl className="kv"><dt>Booking</dt><dd>{me.bookingNo}</dd><dt>Room</dt><dd>{me.room ?? 'Not assigned yet'}</dd><dt>Check-in</dt><dd>{d(me.checkIn)}{me.hotel.checkInTime ? ` from ${me.hotel.checkInTime}` : ''}</dd><dt>Check-out</dt><dd>{d(me.checkOut)}</dd><dt>Balance due</dt><dd>{me.balance > 0 ? money(me.balance) : 'Paid in full'}</dd></dl>
      {me.hotel.address && <p className="small">{me.hotel.address}</p>}{me.hotel.contactPhone && <p className="small">Front desk: <a href={`tel:${me.hotel.contactPhone}`}>{me.hotel.contactPhone}</a></p>}</section>
    <section className="card"><h3>All your bookings</h3>{bk.loading ? <p className="muted">Loading…</p> : !bk.data?.length ? <p className="muted">None found.</p> : bk.data.map((b) => <div key={b.bookingNo} className="row item"><div><b>{b.product}</b><p className="muted small">{b.bookingNo} · {d(b.startAt)}</p></div><span className="small">{b.status.toLowerCase()}</span></div>)}</section>
    <button onClick={onOut}>Sign out</button></div>;
}

type SR = { new (): { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null; start(): void; stop(): void } };
function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: 'Hello! Ask me about the hotel, the area, or your stay. You can write or speak in your own language.' }]);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [lang, setLang] = useState(''); const [rec, setRec] = useState(false); const [speaking, setSpeaking] = useState(false);
  const bottom = useRef<HTMLDivElement>(null); const recog = useRef<InstanceType<SR> | null>(null);
  const SRC: SR | undefined = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition; const canTalk = 'speechSynthesis' in window;
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);
  useEffect(() => () => { recog.current?.stop(); window.speechSynthesis?.cancel(); }, []);
  async function send(raw?: string) {
    const m = (raw ?? text).trim(); if (!m || busy) return; setText(''); setBusy(true);
    const history = msgs.slice(1).slice(-8).map(({ role, content }) => ({ role, content }));
    setMsgs((x) => [...x, { role: 'user', content: m }]);
    try { const r = await call<{ answer: string; sources: string[]; mode: string }>('/assistant', { method: 'POST', body: { message: m, history } }); setMsgs((x) => [...x, { role: 'assistant', content: r.answer, sources: r.sources, mode: r.mode }]); }
    catch (e) { setMsgs((x) => [...x, { role: 'assistant', content: (e as ApiError).message }]); } finally { setBusy(false); }
  }
  function listen() {
    if (!SRC) return; if (rec) { recog.current?.stop(); return; }
    const r = new SRC(); r.lang = lang || navigator.language || 'en-US'; r.interimResults = true; r.continuous = false; recog.current = r; setRec(true);
    r.onresult = (e) => { const t = Array.from(e.results as ArrayLike<any>).map((x) => x[0].transcript).join(' '); setText(t); };
    r.onerror = () => setRec(false);
    r.onend = () => setRec(false);
    r.start();
  }
  function say(t: string) {
    const s = window.speechSynthesis; if (speaking) { s.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(t); if (lang) u.lang = lang; u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false); setSpeaking(true); s.speak(u);
  }
  return <div className="chat">
    <div className="log" role="log" aria-live="polite">{msgs.map((m, i) => <div key={i} className={`bubble ${m.role}`}><p>{m.content}</p>{m.role === 'assistant' && i > 0 && <div className="meta">{m.sources && m.sources.length > 0 && <span className="small muted">From: {m.sources.join(', ')}</span>}{canTalk && <button className="link" onClick={() => say(m.content)}>{speaking ? 'Stop' : 'Read aloud'}</button>}</div>}</div>)}{busy && <div className="bubble assistant"><p className="muted">Thinking…</p></div>}<div ref={bottom} /></div>
    <form className="compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <select aria-label="Voice language" value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <div className="row"><input aria-label="Your question" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or tap the microphone" maxLength={1000} />
        {SRC && <button type="button" className={rec ? 'rec' : ''} onClick={listen} aria-label={rec ? 'Stop listening' : 'Speak your question'} aria-pressed={rec}>🎤</button>}
        <button className="primary" disabled={busy || !text.trim()}>Send</button></div>
      {!SRC && <p className="small muted">Voice input is not supported in this browser. You can still type.</p>}</form></div>;
}

type Tab = 'home' | 'services' | 'dining' | 'chat' | 'stay';
const TABS: [Tab, string, string][] = [['home', 'Home', '🏠'], ['services', 'Services', '🛎️'], ['dining', 'Dining', '🍽️'], ['chat', 'Assistant', '💬'], ['stay', 'My stay', '🏨']];

function Signed({ onOut }: { onOut: () => void }) {
  const me = useAsync<Me>('/me'); const reqs = useAsync<Req[]>('/requests'); const [tab, setTab] = useState<Tab>('home');
  useEffect(() => { const t = setInterval(() => void reqs.reload(), 20000); return () => clearInterval(t); }, [reqs.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  if (me.loading) return <main className="center"><p className="muted">Loading your stay…</p></main>;
  if (me.err || !me.data) return <main className="center stack"><p role="alert" className="error">{me.err || 'Could not load your stay.'}</p><button onClick={me.reload}>Try again</button><button onClick={onOut}>Sign out</button></main>;
  const m = me.data;
  return <div className="app"><header><b>{m.hotel.name}</b><span className="muted small">{m.room ? `Room ${m.room}` : m.bookingNo}</span></header>
    <main>{tab === 'home' && <Home me={m} go={setTab} reqs={reqs.data ?? []} />}{tab === 'services' && <Services me={m} reqs={reqs.data ?? []} reload={reqs.reload} />}{tab === 'dining' && <Dining me={m} />}{tab === 'chat' && <Chat />}{tab === 'stay' && <Stay me={m} onOut={onOut} />}</main>
    <nav aria-label="Sections">{TABS.map(([k, l, i]) => <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}><span aria-hidden>{i}</span>{l}</button>)}</nav></div>;
}

export default function App() {
  const [signed, setSigned] = useState(!!getToken());
  useEffect(() => { setOnExpired(() => setSigned(false)); }, []);
  const out = () => { setToken(null); window.speechSynthesis?.cancel(); setSigned(false); };
  return signed ? <Signed onOut={out} /> : <SignIn onDone={() => setSigned(true)} />;
}

import { KeyRound, Plug, RefreshCw, Webhook } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Pagination, Select, Spinner, Switch, Table, Td, Th } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dt, label } from '../booking/fmt';
import { post, useAct, useGet, useList } from '../booking/hooks';

const PMS = ['mock', 'opera-cloud', 'vhp', 'none'];
const SCOPES = ['bookings:read', 'bookings:write', 'availability:read', 'rates:write', 'pms:read'];
const TOPICS = ['booking.created', 'booking.status_changed', 'stay.checked_in', 'stay.checked_out', 'room.status_changed', 'charge.posted', 'request.created', 'inventory.changed', 'rate.changed', 'payment.succeeded'];
const tone = (s: string) => (({ CONNECTED: 'success', DONE: 'success', ERROR: 'danger', DEAD: 'danger', FAILED: 'warning', PENDING: 'warning', DISCONNECTED: 'neutral', SKIPPED: 'neutral' }) as const)[s as 'DONE'] ?? 'neutral';

function Secret({ title, value, onClose }: { title: string; value: string; onClose: () => void }) {
  return <Modal open onClose={onClose} title={title} footer={<Button onClick={onClose}>I have copied it</Button>}>
    <p className="mb-2 text-sm text-muted-foreground">Shown once. Store it in your secret manager.</p>
    <code className="block break-all rounded-md bg-muted p-3 text-sm" data-testid="secret">{value}</code></Modal>;
}

function Connections() {
  const q = useGet<any[]>('/integrations');
  const { scopeSupplier, user } = useAuth();
  const needScope = user?.role === 'SUPER_ADMIN' && !scopeSupplier;
  const [add, setAdd] = useState(false); const [secret, setSecret] = useState<string | null>(null);
  const [f, setF] = useState({ kind: 'PMS', provider: 'mock', name: '', baseUrl: '', hotelCode: '', secretRef: '' });
  const create = useAct(() => api<any>('/integrations', { method: 'POST', body: { kind: f.kind, provider: f.provider, name: f.name, secretRef: f.secretRef || undefined, config: Object.fromEntries(Object.entries({ baseUrl: f.baseUrl, hotelCode: f.hotelCode }).filter(([, v]) => v)) } }), 'Connection created', (r) => { setAdd(false); setSecret(r.data.inboundSecret ?? null); });
  const test = useAct((id: string) => post(`/integrations/${id}/test`), undefined, (r: any) => { const d = r.data; (d.ok ? import('sonner').then((m) => m.toast.success(d.message)) : import('sonner').then((m) => m.toast.error(d.message))); });
  const sync = useAct((id: string) => post(`/integrations/${id}/sync`), 'Sync finished');
  const toggle = useAct((c: any) => api(`/integrations/${c.id}`, { method: 'PATCH', body: { enabled: !c.enabled } }));
  const del = useAct((id: string) => api(`/integrations/${id}`, { method: 'DELETE' }), 'Connection removed');
  if (q.isLoading) return <Spinner />; if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Property management, channel, payment and e-mail connections.</p><Button disabled={needScope} title={needScope ? 'Pick a supplier first' : ''} onClick={() => setAdd(true)}><Plug className="h-4 w-4" />Add connection</Button></div>
    {!q.data?.length ? <EmptyState title="No connections yet" hint="Start with the mock PMS to try the flow." /> : <Card><Table><thead><tr><Th>Name</Th><Th>Kind</Th><Th>Provider</Th><Th>Status</Th><Th>Last sync</Th><Th>On</Th><Th /></tr></thead><tbody>
      {q.data.map((c) => <tr key={c.id}><Td className="font-medium">{c.name}{c.lastError && <div className="max-w-xs truncate text-xs text-destructive" title={c.lastError}>{c.lastError}</div>}</Td><Td>{c.kind}</Td><Td>{c.provider}</Td><Td><Badge tone={tone(c.status)}>{label(c.status)}</Badge></Td><Td className="whitespace-nowrap text-xs">{dt(c.lastSyncAt)}</Td>
        <Td><Switch label={`Enable ${c.name}`} checked={c.enabled} onChange={() => toggle.mutate(c)} /></Td>
        <Td className="whitespace-nowrap text-right">{c.kind === 'PMS' && <><Button size="sm" variant="outline" onClick={() => test.mutate(c.id)}>Test</Button> <Button size="sm" variant="outline" onClick={() => sync.mutate(c.id)} loading={sync.isPending && sync.variables === c.id}><RefreshCw className="h-3.5 w-3.5" />Sync</Button> </>}<Button size="sm" variant="ghost" onClick={() => del.mutate(c.id)}>Remove</Button></Td></tr>)}
    </tbody></Table></Card>}
    {add && <Modal open onClose={() => setAdd(false)} title="Add connection" footer={<><Button variant="outline" onClick={() => setAdd(false)}>Cancel</Button><Button type="submit" form="cf" loading={create.isPending} disabled={f.name.length < 1}>Create</Button></>}>
      <form id="cf" className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <Field label="Kind">{(id) => <Select id={id} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, provider: e.target.value === 'PMS' ? 'mock' : '' })}>{['PMS', 'CHANNEL', 'PAYMENT', 'EMAIL', 'AI'].map((k) => <option key={k}>{k}</option>)}</Select>}</Field>
        <Field label="Provider" hint={f.kind === 'PMS' ? 'OPERA Cloud and VHP are stubs until credentials and the vendor spec are available' : 'lowercase, e.g. siteminder'}>{(id) => f.kind === 'PMS' ? <Select id={id} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}>{PMS.map((p) => <option key={p}>{p}</option>)}</Select> : <Input id={id} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} />}</Field>
        <Field label="Name" required>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} />}</Field>
        <Field label="Base URL">{(id) => <Input id={id} value={f.baseUrl} onChange={(e) => setF({ ...f, baseUrl: e.target.value })} placeholder="https://…" />}</Field>
        <Field label="Hotel code">{(id) => <Input id={id} value={f.hotelCode} onChange={(e) => setF({ ...f, hotelCode: e.target.value })} />}</Field>
        <Field label="Secret reference" hint="Name of an environment variable holding the credential, e.g. OPERA_CLIENT_SECRET. Never the secret itself.">{(id) => <Input id={id} value={f.secretRef} onChange={(e) => setF({ ...f, secretRef: e.target.value.toUpperCase() })} />}</Field>
      </form></Modal>}
    {secret && <Secret title="Inbound secret" value={secret} onClose={() => setSecret(null)} />}
  </div>;
}

function Keys() {
  const q = useGet<any[]>('/api-keys'); const [name, setName] = useState(''); const [scopes, setScopes] = useState<string[]>(['bookings:read']); const [key, setKey] = useState<string | null>(null);
  const create = useAct(() => api<any>('/api-keys', { method: 'POST', body: { name, scopes } }), undefined, (r) => { setKey(r.data.key); setName(''); });
  const revoke = useAct((id: string) => api(`/api-keys/${id}`, { method: 'DELETE' }), 'Key revoked');
  if (q.isLoading) return <Spinner />; if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return <div className="space-y-3">
    <Card className="space-y-3 p-4"><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Field label="New API key name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}</Field><div className="self-end"><Button onClick={() => create.mutate()} loading={create.isPending} disabled={!name.trim() || !scopes.length}><KeyRound className="h-4 w-4" />Create key</Button></div></div>
      <div className="flex flex-wrap gap-3 text-sm">{SCOPES.map((s) => <label key={s} className="flex items-center gap-1.5"><input type="checkbox" checked={scopes.includes(s)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))} />{s}</label>)}</div></Card>
    {!q.data?.length ? <EmptyState title="No API keys" /> : <Card><Table><thead><tr><Th>Name</Th><Th>Prefix</Th><Th>Scopes</Th><Th>Last used</Th><Th>State</Th><Th /></tr></thead><tbody>{q.data.map((k) => <tr key={k.id}><Td className="font-medium">{k.name}</Td><Td><code>{k.prefix}</code></Td><Td className="text-xs">{(k.scopes ?? []).join(', ')}</Td><Td className="text-xs">{dt(k.lastUsedAt)}</Td><Td>{k.revokedAt ? <Badge tone="danger">Revoked</Badge> : <Badge tone="success">Active</Badge>}</Td><Td className="text-right">{!k.revokedAt && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(k.id)}>Revoke</Button>}</Td></tr>)}</tbody></Table></Card>}
    {key && <Secret title="New API key" value={key} onClose={() => setKey(null)} />}
  </div>;
}

function Hooks() {
  const q = useGet<any[]>('/webhooks'); const [url, setUrl] = useState('https://'); const [topics, setTopics] = useState<string[]>(['booking.created']); const [secret, setSecret] = useState<string | null>(null);
  const create = useAct(() => api<any>('/webhooks', { method: 'POST', body: { url, topics } }), 'Webhook added', (r) => { setSecret(r.data.secret ?? null); setUrl('https://'); });
  const test = useAct((id: string) => post(`/webhooks/${id}/test`), 'Test event queued');
  const del = useAct((id: string) => api(`/webhooks/${id}`, { method: 'DELETE' }), 'Webhook removed');
  const reveal = async (id: string) => setSecret((await api<any>(`/webhooks/${id}/secret`)).data.secret);
  if (q.isLoading) return <Spinner />; if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return <div className="space-y-3">
    <Card className="space-y-3 p-4"><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Field label="Endpoint URL (https)">{(id) => <Input id={id} value={url} onChange={(e) => setUrl(e.target.value)} />}</Field><div className="self-end"><Button onClick={() => create.mutate()} loading={create.isPending} disabled={!url.startsWith('https://') || !topics.length}><Webhook className="h-4 w-4" />Add webhook</Button></div></div>
      <div className="flex flex-wrap gap-3 text-sm">{TOPICS.map((s) => <label key={s} className="flex items-center gap-1.5"><input type="checkbox" checked={topics.includes(s)} onChange={(e) => setTopics(e.target.checked ? [...topics, s] : topics.filter((x) => x !== s))} />{s}</label>)}</div></Card>
    {!q.data?.length ? <EmptyState title="No webhooks" hint="Deliveries are signed with X-Signature (HMAC-SHA256)." /> : <Card><Table><thead><tr><Th>URL</Th><Th>Topics</Th><Th>State</Th><Th /></tr></thead><tbody>{q.data.map((w) => <tr key={w.id}><Td className="max-w-xs truncate font-medium" title={w.url}>{w.url}</Td><Td className="text-xs">{(w.topics ?? []).join(', ')}</Td><Td>{w.active ? <Badge tone="success">Active</Badge> : <Badge>Paused</Badge>}</Td><Td className="whitespace-nowrap text-right"><Button size="sm" variant="outline" onClick={() => test.mutate(w.id)}>Send test</Button> <Button size="sm" variant="outline" onClick={() => reveal(w.id)}>Secret</Button> <Button size="sm" variant="ghost" onClick={() => del.mutate(w.id)}>Remove</Button></Td></tr>)}</tbody></Table></Card>}
    {secret && <Secret title="Signing secret" value={secret} onClose={() => setSecret(null)} />}
  </div>;
}

export function EventLog({ compact }: { compact?: boolean }) {
  const [page, setPage] = useState(1); const [status, setStatus] = useState(''); const [direction, setDirection] = useState('');
  const q = useList<any>('/integration-events', { page, limit: compact ? 10 : 25, status: status || undefined, direction: direction || undefined });
  const retry = useAct((id: string) => post(`/integration-events/${id}/retry`), 'Event re-queued');
  const run = useAct(() => post('/integration-events/run'), 'Delivery run finished');
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><Select aria-label="Status" className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{['PENDING', 'DONE', 'FAILED', 'DEAD', 'SKIPPED'].map((s) => <option key={s}>{s}</option>)}</Select>
      <Select aria-label="Direction" className="w-36" value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }}><option value="">In &amp; out</option><option value="IN">Inbound</option><option value="OUT">Outbound</option></Select>
      <Button variant="outline" onClick={() => run.mutate()} loading={run.isPending}>Deliver now</Button></div>
    {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.data.length ? <EmptyState title="No events" /> : <Card><Table><thead><tr><Th>When</Th><Th>Dir</Th><Th>Topic</Th><Th>Status</Th><Th>Tries</Th><Th>Error</Th><Th /></tr></thead><tbody>{q.data.data.map((e: any) => <tr key={e.id}><Td className="whitespace-nowrap text-xs">{dt(e.createdAt)}</Td><Td>{e.direction}</Td><Td>{e.topic}</Td><Td><Badge tone={tone(e.status)}>{label(e.status)}</Badge></Td><Td>{e.attempts}</Td><Td className="max-w-xs truncate text-xs" title={e.lastError}>{e.lastError}</Td><Td className="text-right">{['FAILED', 'DEAD'].includes(e.status) && <Button size="sm" variant="outline" onClick={() => retry.mutate(e.id)}>Retry</Button>}</Td></tr>)}</tbody></Table>{q.data.meta && <Pagination page={q.data.meta.page} limit={q.data.meta.limit} total={q.data.meta.total} onPage={setPage} />}</Card>}
  </div>;
}

export default function IntegrationsPage() {
  const [tab, setTab] = useState<'c' | 'k' | 'w' | 'e'>('c');
  const tabs = [['c', 'Connections'], ['k', 'API keys'], ['w', 'Webhooks'], ['e', 'Event log']] as const;
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold">Integrations</h1><p className="text-sm text-muted-foreground">Connect a property management system, channel manager and outside tools.</p></div>
    <div role="tablist" className="flex gap-1 border-b">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{l}</button>)}</div>
    {tab === 'c' && <Connections />}{tab === 'k' && <Keys />}{tab === 'w' && <Hooks />}{tab === 'e' && <EventLog />}</div>;
}

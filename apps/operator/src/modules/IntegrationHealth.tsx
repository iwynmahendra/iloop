import { Badge, Card, EmptyState, ErrorState, EventLog, Spinner, Table, Td, Th, dt, label, useGet, useList } from '@booking/admin-kit';

const tone = (s: string) => (({ CONNECTED: 'success', ERROR: 'danger', DISCONNECTED: 'neutral' }) as const)[s as 'ERROR'] ?? 'neutral';

/** Cross-supplier view: which connections are healthy, and what is stuck in the outbox. Pick a supplier in the switcher to act on one. */
export default function IntegrationHealth() {
  const c = useGet<any[]>('/integrations');
  const sup = useList<any>('/suppliers', { limit: 100 });
  const dead = useList<any>('/integration-events', { status: 'DEAD', limit: 5 });
  const failed = useList<any>('/integration-events', { status: 'FAILED', limit: 5 });
  const name = (id: string) => { const s = sup.data?.data.find((x: any) => x.id === id); return s ? `${s.code} · ${s.name}` : id.slice(0, 8); };
  const list = c.data ?? [];
  const bad = list.filter((x) => x.status === 'ERROR' || !x.enabled).length;
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold">Integration health</h1><p className="text-sm text-muted-foreground">Connections and the delivery queue across all suppliers.</p></div>
    <div className="grid gap-3 sm:grid-cols-4">{[['Connections', list.length], ['Needs attention', bad], ['Failed events', failed.data?.meta?.total ?? 0], ['Dead events', dead.data?.meta?.total ?? 0]].map(([k, v]) => <Card key={k as string} className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className={`text-2xl font-semibold tabular-nums ${Number(v) > 0 && k !== 'Connections' ? 'text-warning' : ''}`}>{v}</p></Card>)}</div>
    {c.isLoading ? <Spinner /> : c.isError ? <ErrorState error={c.error} retry={() => c.refetch()} /> : !list.length ? <EmptyState title="No connections configured" hint="Suppliers add them under Integrations in their own admin." /> :
      <Card><Table><thead><tr><Th>Supplier</Th><Th>Connection</Th><Th>Kind</Th><Th>Status</Th><Th>Last OK</Th><Th>Last sync</Th><Th>Error</Th></tr></thead><tbody>{list.map((x) => <tr key={x.id}><Td>{name(x.supplierId)}</Td><Td className="font-medium">{x.name}<div className="text-xs text-muted-foreground">{x.provider}</div></Td><Td>{x.kind}</Td><Td><Badge tone={tone(x.status)}>{x.enabled ? label(x.status) : 'Disabled'}</Badge></Td><Td className="whitespace-nowrap text-xs">{dt(x.lastOkAt)}</Td><Td className="whitespace-nowrap text-xs">{dt(x.lastSyncAt)}</Td><Td className="max-w-xs truncate text-xs text-destructive" title={x.lastError}>{x.lastError}</Td></tr>)}</tbody></Table></Card>}
    <h2 className="pt-2 text-sm font-semibold">Event log</h2><EventLog compact />
  </div>;
}

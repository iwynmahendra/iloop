import { Badge, Card, ErrorState, Spinner, dt, useGet } from '@booking/admin-kit';
import { Link } from 'react-router-dom';

const ROOM: [string, string][] = [['DIRTY', 'Dirty'], ['CLEANING', 'Cleaning'], ['CLEAN', 'Clean'], ['INSPECTED', 'Inspected'], ['OUT_OF_ORDER', 'Out of order']];
const LINK: Record<string, string> = { REQUEST_PAST_TARGET: '/requests', TASK_OVERDUE: '/tasks', TASK_BLOCKED: '/tasks', ORDER_WAITING: '/dining' };
const LABEL: Record<string, string> = { REQUEST_PAST_TARGET: 'Guest request past target', TASK_OVERDUE: 'Task overdue', TASK_BLOCKED: 'Task blocked', ORDER_WAITING: 'Order waiting' };

export default function Overview() {
  const q = useGet<any>('/ops/overview', undefined, { refetchInterval: 20_000 });
  if (q.isLoading) return <Spinner />; if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data; const maxOpen = Math.max(1, ...d.staff.map((s: any) => s.open));
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold">Ops board</h1><p className="text-sm text-muted-foreground">What needs attention right now. Refreshes every 20 seconds.</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[['Open work', d.open, '/tasks'], ['Guest requests', d.openRequests, '/requests'], ['Past target', d.overdueCount, '/requests'], ['Blocked', d.blockedCount, '/tasks'], ['Open orders', d.openOrders, '/dining']].map(([k, v, to]) => <Link key={k as string} to={to as string}><Card className="p-4 hover:bg-accent/50"><p className="text-xs text-muted-foreground">{k}</p><p className={`text-2xl font-semibold tabular-nums ${['Past target', 'Blocked'].includes(k as string) && Number(v) > 0 ? 'text-destructive' : ''}`}>{v}</p></Card></Link>)}</div>
    <Card><h2 className="border-b p-3 text-sm font-semibold">Alerts <Badge className="ml-1">{d.alerts.length}</Badge></h2>{!d.alerts.length ? <p className="p-4 text-sm text-muted-foreground">No alerts. Everything is within target.</p> : <ul className="divide-y">{d.alerts.map((a: any, i: number) => <li key={i}><Link to={LINK[a.type] ?? '/tasks'} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-accent/50"><span><b>{LABEL[a.type]}:</b> {a.text} <span className="text-muted-foreground">· {a.department}</span></span><span className="whitespace-nowrap text-xs text-muted-foreground">{a.since ? dt(a.since) : ''}</span></Link></li>)}</ul>}</Card>
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-4"><h2 className="mb-2 text-sm font-semibold">Rooms</h2><ul className="space-y-1 text-sm">{ROOM.map(([k, l]) => <li key={k} className="flex justify-between"><span>{l}</span><span className="tabular-nums">{d.rooms[k]}</span></li>)}</ul></Card>
      <Card className="p-4"><h2 className="mb-2 text-sm font-semibold">Open by department</h2><ul className="space-y-1 text-sm">{d.byDept.map((x: any) => <li key={x.department} className="flex justify-between"><span>{x.department}</span><span className="tabular-nums">{x.open}</span></li>)}</ul></Card>
      <Card className="p-4"><h2 className="mb-2 text-sm font-semibold">Workload</h2><ul className="space-y-2 text-sm">{d.staff.map((s: any) => <li key={s.id}><div className="flex justify-between"><span>{s.name} <span className="text-xs text-muted-foreground">{s.department}{s.onDuty ? '' : ' · off'}</span></span><span className="tabular-nums">{s.open}</span></div><div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${(s.open / maxOpen) * 100}%` }} /></div></li>)}</ul></Card></div></div>;
}

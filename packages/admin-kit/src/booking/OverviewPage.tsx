import { Link } from 'react-router-dom';
import { Card, ErrorState, Spinner } from '../components/ui';
import { dt, money, type Product } from './fmt';
import { useGet } from './hooks';

export interface Tile { label: string; value: (d: any) => string | number; to?: string; tone?: 'warn' }
const T = ({ t, d }: { t: Tile; d: any }) => { const v = t.value(d); const body = <><dt className="text-xs text-muted-foreground">{t.label}</dt><dd className={`text-2xl font-semibold tabular-nums ${t.tone === 'warn' && Number(v) > 0 ? 'text-warning' : ''}`}>{v}</dd></>; return t.to ? <Link to={t.to} className="block rounded-md p-3 hover:bg-accent">{body}</Link> : <div className="p-3">{body}</div>; };

/** Today at a glance, from GET /booking-overview. Each app passes its own tiles. */
export default function OverviewPage({ title, subtitle, product, tiles, bookingsPath = '/bookings' }: { title: string; subtitle?: string; product?: Product; tiles: Tile[]; bookingsPath?: string }) {
  const q = useGet<any>('/booking-overview', { product }, { refetchInterval: 60_000 });
  if (q.isLoading) return <Spinner />; if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">{subtitle ?? `Today, ${d.date}`}</p></div>
    <Card><dl className="grid grid-cols-2 gap-1 p-2 md:grid-cols-3 xl:grid-cols-4">{tiles.map((t) => <T key={t.label} t={t} d={d} />)}
      <T t={{ label: 'Created today', value: (x) => x.createdToday, to: bookingsPath }} d={d} />
      <T t={{ label: 'Pending holds', value: (x) => x.pending, to: `${bookingsPath}?status=PENDING`, tone: 'warn' }} d={d} />
      <T t={{ label: 'Confirmed next 7 days', value: (x) => x.confirmedNext7Days, to: `${bookingsPath}?status=CONFIRMED` }} d={d} />
      <T t={{ label: 'Unpaid', value: (x) => `${x.unpaid.count} · ${money(x.unpaid.outstanding)}`, tone: 'warn' }} d={d} /></dl></Card>
    {d.nextHoldExpiry && <p className="text-sm text-muted-foreground">Next hold expires {dt(d.nextHoldExpiry.holdExpiresAt)} ({d.nextHoldExpiry.bookingNo}).</p>}
  </div>;
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Badge, Card, ErrorState, Spinner, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, humanize } from '@/lib/utils';

const TILES: { group: string; title: string; items: { key: string; label: string; to: string }[] }[] = [
  { group: 'hotel', title: 'Hotel', items: [{ key: 'hotels', label: 'Hotels', to: '/hotel/hotels' }, { key: 'roomTypes', label: 'Room types', to: '/hotel/room-types' }, { key: 'activeRatePlans', label: 'Current & future rate plans', to: '/hotel/rate-plans' }] },
  { group: 'trips', title: 'Trips', items: [{ key: 'trips', label: 'Trips', to: '/trips/trips' }, { key: 'variants', label: 'Variants', to: '/trips/trip-variants' }, { key: 'upcomingSchedules', label: 'Upcoming departures', to: '/trips/trip-schedules' }] },
  { group: 'transport', title: 'Transport', items: [{ key: 'services', label: 'Services', to: '/transport/transport-services' }, { key: 'vehicleTypes', label: 'Vehicle types', to: '/transport/vehicle-types' }, { key: 'drivers', label: 'Drivers', to: '/transport/drivers' }, { key: 'vehicles', label: 'Vehicles', to: '/transport/vehicles' }] },
  { group: 'club', title: 'Club', items: [{ key: 'clubs', label: 'Clubs', to: '/club/clubs' }, { key: 'upcomingEvents', label: 'Upcoming events', to: '/club/club-events' }, { key: 'ticketTypes', label: 'Ticket types', to: '/club/club-ticket-types' }] },
  { group: 'shared', title: 'Shared data', items: [{ key: 'cities', label: 'Cities & areas', to: '/shared/cities' }, { key: 'amenities', label: 'Amenities', to: '/shared/amenities' }, { key: 'media', label: 'Images', to: '/shared/media-assets' }] },
];

export default function Dashboard() {
  const { user, scopeSupplier } = useAuth();
  const q = useQuery({ queryKey: ['dashboard', scopeSupplier], queryFn: () => api<any>('/dashboard') });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data!.data;
  const superAll = user?.role === 'SUPER_ADMIN' && !scopeSupplier;
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">Dashboard</h1><p className="text-sm text-muted-foreground">{superAll ? 'All suppliers' : user?.role === 'SUPER_ADMIN' ? 'Selected supplier' : user?.supplier?.name}</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TILES.map((t) => (
          <Card key={t.group} className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t.title}</h2>
            <dl className="grid grid-cols-2 gap-3">
              {t.items.map((i) => (
                <Link key={i.key} to={i.to} className="rounded-md p-2 hover:bg-accent"><dt className="text-xs text-muted-foreground">{i.label}</dt><dd className="text-2xl font-semibold tabular-nums">{d.counts[t.group]?.[i.key] ?? 0}</dd></Link>
              ))}
            </dl>
          </Card>
        ))}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Needs attention</h2>
          <ul className="space-y-1.5 text-sm">
            {[['hotels', 'Inactive hotels', '/hotel/hotels'], ['trips', 'Inactive trips', '/trips/trips'], ['services', 'Inactive transport services', '/transport/transport-services'], ['clubs', 'Inactive clubs', '/club/clubs']].map(([k, label, to]) => (
              <li key={k} className="flex justify-between"><Link to={`${to}?status=INACTIVE`} className="hover:underline">{label}</Link><span className="tabular-nums">{d.inactive[k!]}</span></li>
            ))}
          </ul>
        </Card>
      </div>

      {superAll && d.suppliers && (
        <Card>
          <div className="flex items-center justify-between border-b p-4"><h2 className="font-semibold">Supplier overview</h2><span className="text-sm text-muted-foreground">{d.supplierTotals.active} active of {d.supplierTotals.total}</span></div>
          <Table><thead><tr><Th>Code</Th><Th>Name</Th><Th>Status</Th><Th>Hotels</Th><Th>Trips</Th><Th>Transport</Th><Th>Clubs</Th><Th>Users</Th></tr></thead>
            <tbody>{d.suppliers.map((s: any) => <tr key={s.id}><Td className="font-mono text-xs">{s.code}</Td><Td className="font-medium">{s.name}</Td><Td><Badge tone={s.status === 'ACTIVE' ? 'success' : 'danger'}>{humanize(s.status)}</Badge></Td><Td>{s.hotels}</Td><Td>{s.trips}</Td><Td>{s.services}</Td><Td>{s.clubs}</Td><Td>{s.users}</Td></tr>)}</tbody></Table>
        </Card>
      )}

      <Card>
        <div className="border-b p-4"><h2 className="font-semibold">Recent changes</h2></div>
        {d.recentChanges.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nothing has changed yet.</p> : (
          <ul className="divide-y">{d.recentChanges.map((c: any) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2"><Badge tone={c.action === 'DELETE' ? 'danger' : c.action === 'CREATE' ? 'success' : 'neutral'}>{humanize(c.action)}</Badge>{humanize(c.entityType.replace(/([a-z])([A-Z])/g, '$1_$2'))}<span className="text-muted-foreground">by {c.userEmail ?? 'system'}</span></span>
              <time className="text-xs text-muted-foreground" dateTime={c.createdAt}>{fmtDate(c.createdAt, true)}</time>
            </li>))}</ul>
        )}
      </Card>
    </div>
  );
}

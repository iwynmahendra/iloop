import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronDown, ChevronRight, ClipboardList, KeyRound, LayoutDashboard, LogOut, Menu, Moon, ScrollText, Sun, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { resources } from '../generated/resources';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { cn } from '../lib/utils';
import { useApp } from '../shell/config';
import { Button, Select } from './ui';

export const GROUP_LABEL: Record<string, string> = { shared: 'Shared data', hotel: 'Hotel', trips: 'Trips', transport: 'Transport', club: 'Club' };

function SupplierSwitcher() {
  const { user, scopeSupplier, setScopeSupplier } = useAuth();
  const { data } = useQuery({ queryKey: ['suppliers', 'switcher'], queryFn: () => api<any[]>('/suppliers', { query: { limit: 100, sort: 'name:asc' } }), enabled: user?.role === 'SUPER_ADMIN' });
  if (user?.role !== 'SUPER_ADMIN') return user?.supplier ? <span className="hidden truncate rounded-md bg-secondary px-2.5 py-1 text-xs font-medium sm:block" title="Your supplier">{user.supplier.code} · {user.supplier.name}</span> : null;
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="hidden text-muted-foreground sm:inline">Supplier</span>
      <Select aria-label="Supplier switcher" className="h-8 w-44 text-xs sm:w-56" value={scopeSupplier ?? ''} onChange={(e) => setScopeSupplier(e.target.value || null)}>
        <option value="">All suppliers</option>
        {data?.data.filter((s) => !s.isPlatform).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
      </Select>
    </label>
  );
}

function Crumbs() {
  const { pathname } = useLocation();
  const app = useApp();
  const parts = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; to?: string }[] = [{ label: 'Home', to: '/' }];
  if (parts.length === 2 && GROUP_LABEL[parts[0]!]) {
    crumbs.push({ label: GROUP_LABEL[parts[0]!]! });
    crumbs.push({ label: resources.find((r) => r.group === parts[0] && r.path === parts[1])?.plural ?? parts[1]! });
  } else if (parts[0]) crumbs.push({ label: ({ suppliers: 'Suppliers', users: 'Users', 'audit-logs': 'Audit log', account: 'Account', ...app.titles } as Record<string, string>)[parts[0]] ?? (parts[0].charAt(0).toUpperCase() + parts[0].slice(1).replace(/-/g, ' ')) });
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1 truncate">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          {c.to && i < crumbs.length - 1 ? <Link to={c.to} className="hover:text-foreground">{c.label}</Link> : <span className={i === crumbs.length - 1 ? 'font-medium text-foreground' : ''}>{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

const linkCls = ({ isActive }: { isActive: boolean }) => cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors', isActive ? 'bg-primary/10 font-medium text-primary' : 'text-foreground/80 hover:bg-accent');

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { can } = useAuth();
  const app = useApp();
  const { pathname } = useLocation();
  const activeGroup = pathname.split('/')[1];
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (g: string) => open[g] ?? g === activeGroup;
  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <NavLink to="/" end className={linkCls} onClick={onNavigate}><LayoutDashboard className="h-4 w-4" aria-hidden />Dashboard</NavLink>
      {app.nav.map((g) => (
        <div key={g.label}>
          <p className="mt-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
          {g.items.map((i) => <NavLink key={i.to} to={i.to} className={linkCls} onClick={onNavigate}>{i.icon ? <i.icon className="h-4 w-4" /> : <span className="h-4 w-4" aria-hidden />}{i.label}</NavLink>)}
        </div>
      ))}
      {app.groups.length > 0 && <p className="mt-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Setup &amp; data</p>}
      {app.groups.map((g) => (
        <div key={g}>
          <button type="button" aria-expanded={isOpen(g)} onClick={() => setOpen((o) => ({ ...o, [g]: !isOpen(g) }))} className="mt-2 flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent">
            {GROUP_LABEL[g]}<ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !isOpen(g) && '-rotate-90')} aria-hidden />
          </button>
          {isOpen(g) && <div className="ml-1 border-l pl-2">{resources.filter((r) => r.group === g).map((r) => <NavLink key={r.path} to={`/${r.group}/${r.path}`} className={linkCls} onClick={onNavigate}>{r.plural}</NavLink>)}</div>}
        </div>
      ))}
      <p className="mt-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Administration</p>
      {can.manageSuppliers && <NavLink to="/suppliers" className={linkCls} onClick={onNavigate}><Building2 className="h-4 w-4" aria-hidden />Suppliers</NavLink>}
      {can.manageUsers && <NavLink to="/users" className={linkCls} onClick={onNavigate}><Users className="h-4 w-4" aria-hidden />Users</NavLink>}
      {can.audit && <NavLink to="/audit-logs" className={linkCls} onClick={onNavigate}><ScrollText className="h-4 w-4" aria-hidden />Audit log</NavLink>}
      <NavLink to="/account" className={linkCls} onClick={onNavigate}><KeyRound className="h-4 w-4" aria-hidden />Account</NavLink>
    </nav>
  );
}

export default function Layout() {
  const app = useApp();
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const nav = useNavigate();
  const [mobile, setMobile] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMobile(false); }, [pathname]);
  const initials = useMemo(() => (user?.name ?? '').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase(), [user]);
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-2">Skip to content</a>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-card lg:block">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold"><ClipboardList className="h-5 w-5 text-primary" aria-hidden />{app.title}</div>
        <div className="h-[calc(100%-3.5rem)]"><Sidebar onNavigate={() => {}} /></div>
      </aside>
      {mobile && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobile(false)} />
          <div className="relative h-full w-64 bg-card shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4 font-semibold">{app.title}<Button variant="ghost" size="icon" onClick={() => setMobile(false)} aria-label="Close menu"><X className="h-4 w-4" /></Button></div>
            <div className="h-[calc(100%-3.5rem)]"><Sidebar onNavigate={() => setMobile(false)} /></div>
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
          <div className="min-w-0 flex-1"><Crumbs /></div>
          <SupplierSwitcher />
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          <Link to="/account" className="hidden text-right leading-tight sm:block"><span className="block text-sm font-medium">{user?.name}</span><span className="block text-xs text-muted-foreground">{user?.role.replace('_', ' ').toLowerCase()}</span></Link>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary sm:hidden" aria-hidden>{initials}</span>
          <Button variant="ghost" size="icon" onClick={async () => { await logout(); nav('/login'); }} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
        </header>
        <main id="main" className="flex-1 p-3 sm:p-5"><Outlet /></main>
      </div>
    </div>
  );
}

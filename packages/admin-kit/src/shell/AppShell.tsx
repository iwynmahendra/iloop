import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from '../components/Layout';
import { Button, Spinner } from '../components/ui';
import { AuthProvider, useAuth, type Role } from '../lib/auth';
import Account from '../pages/Account';
import { ForgotPage, LoginPage, ResetPage } from '../pages/Auth';
import AuditLog from '../pages/AuditLog';
import Dashboard from '../pages/Dashboard';
import MediaLibrary from '../pages/MediaLibrary';
import ResourcePage from '../pages/ResourcePage';
import Suppliers from '../pages/Suppliers';
import Users from '../pages/Users';
import { AppConfigProvider, type AppConfig } from './config';

function RequireAuth() {
  const { user, loading } = useAuth(); const loc = useLocation();
  if (loading) return <Spinner label="Loading session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  // Users on a temporary password may only use the account page until they change it.
  if (user.mustChangePassword && loc.pathname !== '/account') return <Navigate to="/account?force=1" replace />;
  return <Outlet />;
}
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  return user && roles.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />;
}
const NotFound = () => <div className="py-20 text-center"><h1 className="text-xl font-semibold">Page not found</h1><Button className="mt-4" onClick={() => history.back()}>Go back</Button></div>;

function Routing({ app }: { app: AppConfig }) {
  const Home = app.Home ?? Dashboard;
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPage />} />
      <Route path="/reset-password" element={<ResetPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="account" element={<Account />} />
          <Route path="shared/media-assets" element={<MediaLibrary />} />
          {app.routes}
          <Route path=":group/:path" element={<ResourcePage />} />
          <Route element={<RequireRole roles={['SUPER_ADMIN']} />}><Route path="suppliers" element={<Suppliers />} /></Route>
          <Route element={<RequireRole roles={['SUPER_ADMIN', 'SUPPLIER_ADMIN']} />}><Route path="users" element={<Users />} /><Route path="audit-logs" element={<AuditLog />} /></Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

const client = new QueryClient({ defaultOptions: { queries: { retry: (n, e: any) => n < 1 && !(e?.status >= 400 && e?.status < 500), refetchOnWindowFocus: false, staleTime: 15_000 } } });

/** Boots one admin app. Each app folder calls this once from its main.tsx with its own AppConfig. */
export function mountApp(app: AppConfig, el: HTMLElement = document.getElementById('root')!) {
  document.title = app.title;
  const basename = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  ReactDOM.createRoot(el).render(
    <React.StrictMode>
      <QueryClientProvider client={client}>
        <BrowserRouter basename={basename}>
          <AppConfigProvider value={app}>
            <AuthProvider><Routing app={app} /><Toaster richColors closeButton position="top-right" /></AuthProvider>
          </AppConfigProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

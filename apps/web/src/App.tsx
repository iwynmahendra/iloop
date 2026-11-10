import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { Button, Spinner } from './components/ui';
import { useAuth, type Role } from './lib/auth';
import Account from './pages/Account';
import { ForgotPage, LoginPage, ResetPage } from './pages/Auth';
import AuditLog from './pages/AuditLog';
import Dashboard from './pages/Dashboard';
import MediaLibrary from './pages/MediaLibrary';
import ResourcePage from './pages/ResourcePage';
import Suppliers from './pages/Suppliers';
import Users from './pages/Users';

function RequireAuth() {
  const { user, loading } = useAuth(); const loc = useLocation();
  if (loading) return <Spinner label="Loading session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  // Users on a temporary password may only use the account page until they change it.
  if (user.mustChangePassword && loc.pathname !== '/account') return <Navigate to="/account?force=1" replace />;
  return <Outlet />;
}
function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  return user && roles.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />;
}
const NotFound = () => <div className="py-20 text-center"><h1 className="text-xl font-semibold">Page not found</h1><Button className="mt-4" onClick={() => history.back()}>Go back</Button></div>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPage />} />
      <Route path="/reset-password" element={<ResetPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="account" element={<Account />} />
          <Route path="shared/media-assets" element={<MediaLibrary />} />
          <Route path=":group/:path" element={<ResourcePage />} />
          <Route element={<RequireRole roles={['SUPER_ADMIN']} />}><Route path="suppliers" element={<Suppliers />} /></Route>
          <Route element={<RequireRole roles={['SUPER_ADMIN', 'SUPPLIER_ADMIN']} />}><Route path="users" element={<Users />} /><Route path="audit-logs" element={<AuditLog />} /></Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

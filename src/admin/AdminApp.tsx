import { Loader2, WifiOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import AuroraField from '@/components/primitives/AuroraField';
import { AuthProvider, useAuth } from './auth';
import { AdminDataProvider, useAdminData } from './data';
import { useAdminRoute } from './router';
import AdminShell from './AdminShell';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Reviews from './screens/Reviews';
import Staff from './screens/Staff';
import Applications from './screens/Applications';
import Account from './screens/Account';
import { btnGhost, ToastProvider } from './ui';

/**
 * The whole admin, lazily loaded from main.tsx when the URL hash starts with
 * `#/admin` — not one byte of it reaches a family browsing the site.
 */

function Booting() {
  return (
    <div className="relative grid min-h-[100svh] place-items-center overflow-hidden">
      <AuroraField variant="admin" />
      <Loader2 size={26} className="relative animate-spin text-teal-bright" aria-label="Loading" />
    </div>
  );
}

function Routed() {
  const route = useAdminRoute();
  const { error, reload, loading } = useAdminData();

  if (error && !loading) {
    return (
      <AdminShell area={route.area}>
        <div className="mx-auto max-w-md py-16 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-coral-bright/15 text-coral-bright ring-1 ring-coral-bright/30">
            <WifiOff size={22} />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-text-light">Couldn’t load your data</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-text-light/70">{error}</p>
          <button type="button" onClick={reload} className={cn(btnGhost, 'mt-6')}>
            Try again
          </button>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell area={route.area}>
      {route.area === 'overview' && <Dashboard />}
      {route.area === 'reviews' && <Reviews />}
      {route.area === 'staff' && <Staff />}
      {route.area === 'applications' && <Applications />}
      {route.area === 'account' && <Account />}
    </AdminShell>
  );
}

function Gate() {
  const { token, ready, expired } = useAuth();

  if (!ready) return <Booting />;
  if (!token) return <Login />;

  return (
    <AdminDataProvider>
      <Routed />
      {/* A mid-session 401 floats the login card over a still-mounted shell,
          so anything typed into a drawer survives the re-auth. */}
      {expired && <Login variant="overlay" />}
    </AdminDataProvider>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  );
}

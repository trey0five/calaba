import React, { Suspense, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * The admin is a separate, lazily-loaded chunk gated on the hash, so a family
 * visiting calabatherapy.com never downloads a byte of it.
 */
const AdminApp = React.lazy(() => import('./admin/AdminApp'));

const isAdminHash = () => window.location.hash.startsWith('#/admin');

const INK_FIELD = 'linear-gradient(180deg, #140A2E 0%, #1C0E3E 60%, #241348 100%)';

/** Ink screen while the admin chunk arrives — inline styles, no imports. */
function AdminFallback() {
  return <div style={{ minHeight: '100svh', background: INK_FIELD }} />;
}

/**
 * Anything that throws inside the admin — a render crash, a chunk that failed
 * to load on a flaky connection — used to blank the page with no way out.
 * Styles are inline so this renders even if the admin CSS never arrived.
 */
class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[admin] crashed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100svh',
          background: INK_FIELD,
          display: 'grid',
          placeItems: 'center',
          padding: '1.5rem',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          color: '#F4EEFB',
        }}
      >
        <div
          style={{
            maxWidth: '26rem',
            width: '100%',
            textAlign: 'center',
            borderRadius: '1rem',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '2rem 1.5rem',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            The admin hit a snag
          </h1>
          <p style={{ margin: '0.75rem 0 1.5rem', lineHeight: 1.6, opacity: 0.8 }}>
            Nothing was lost — reloading usually clears it. Your live site is unaffected.
          </p>
          <div
            style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                borderRadius: '999px',
                border: 0,
                padding: '0.7rem 1.4rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: '#F5B027',
                color: '#2A1452',
              }}
            >
              Reload
            </button>
            <a
              href="/"
              style={{
                borderRadius: '999px',
                padding: '0.7rem 1.4rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: '#F4EEFB',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              Back to site
            </a>
          </div>
        </div>
      </div>
    );
  }
}

function Root() {
  const [admin, setAdmin] = useState(isAdminHash);

  useEffect(() => {
    const onHash = () => setAdmin(isAdminHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!admin) return <App />;
  return (
    <AdminErrorBoundary>
      <Suspense fallback={<AdminFallback />}>
        <AdminApp />
      </Suspense>
    </AdminErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);

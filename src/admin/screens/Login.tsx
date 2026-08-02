import { FormEvent, useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { site } from '@/content/site';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { easeOutExpo, usePrefersReducedMotion } from '@/lib/motion';
import { fieldBase, Label, PANEL_BLOOMS, PanelChrome } from '@/lib/ui';
import AuroraField from '@/components/primitives/AuroraField';
import AuroraRibbon from '@/components/primitives/AuroraRibbon';
import ParticleField from '@/components/primitives/ParticleField';
import { useAuth } from '../auth';
import { btnGold, focusRing, useFocusTrap, useModalLayer, useScrollLock, Working } from '../ui';

/**
 * `page` is the signed-out screen. `overlay` is the same card floated over a
 * still-mounted shell after a mid-session 401, so unsaved drawer drafts survive.
 */
export default function Login({ variant = 'page' }: { variant?: 'page' | 'overlay' }) {
  const { signIn, user } = useAuth();
  const reduced = usePrefersReducedMotion();

  const [email, setEmail] = useState(variant === 'overlay' ? (user?.email ?? '') : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  /**
   * The shake is played through animation controls rather than by re-keying the
   * wrapper. Re-keying remounted both inputs on every failed attempt, which
   * blew away focus (and confused password managers) exactly when the person
   * needed the cursor back in the password field.
   */
  const shakeControls = useAnimationControls();
  const shake = () => {
    if (reduced) return;
    void shakeControls.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } });
  };

  /* The re-auth overlay is a real modal: nothing behind it is reachable. */
  const overlay = variant === 'overlay';
  useModalLayer(overlay);
  useScrollLock(overlay);
  useFocusTrap(overlay, cardRef);

  useEffect(() => {
    const t = window.setTimeout(
      () => (variant === 'overlay' ? passwordRef.current : emailRef.current)?.focus(),
      140,
    );
    return () => window.clearTimeout(t);
  }, [variant]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      shake();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      setPassword('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        // The server no longer discloses the exact remaining seconds.
        setError('Too many attempts. Try again in about 15 minutes.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('That email and password don’t match.');
      } else {
        setError('Couldn’t reach the server. Check your connection and try again.');
      }
      shake();
      setPassword('');
      passwordRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const card = (
    <motion.div
      ref={cardRef}
      animate={shakeControls}
      className="relative z-10 w-full max-w-md"
    >
      <PanelChrome
        className="w-full"
        blooms={PANEL_BLOOMS.teal}
        initial={reduced ? false : { opacity: 0, y: 24, scale: 0.97 }}
        animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: easeOutExpo }}
      >
        <div className="relative z-10 px-6 py-8 sm:px-8">
          <div className="text-center">
            <img
              src={site.logo}
              alt="CAL-ABA"
              className="mx-auto h-16 w-16 object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
            />
            <h1 className="type-lift mt-4 text-2xl font-bold tracking-tight text-text-light">
              CAL-ABA <span className="brand-gradient-text-bright">Admin</span>
            </h1>
            <p className="mt-1.5 text-sm text-text-light/70">
              {variant === 'overlay'
                ? 'Your session ended. Sign in to pick up where you left off.'
                : 'Sign in to manage reviews, your team and applications.'}
            </p>
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-7 space-y-4">
            <div>
              <Label htmlFor="admin-email">Email</Label>
              <div className="relative">
                <Mail
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45"
                  aria-hidden="true"
                />
                <input
                  id="admin-email"
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@calabatherapy.com"
                  aria-invalid={!!error}
                  className={cn(fieldBase, 'pl-11', error && 'border-coral-bright')}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Lock
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45"
                  aria-hidden="true"
                />
                <input
                  id="admin-password"
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  aria-invalid={!!error}
                  className={cn(fieldBase, 'pl-11 pr-12', error && 'border-coral-bright')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm font-medium text-coral-bright">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className={cn(btnGold, 'w-full', !busy && 'animate-gold-pulse')}
            >
              {busy ? <Working label="Signing in…" /> : 'Sign in'}
            </button>
          </form>

          {!overlay && (
            <p className="mt-6 text-center">
              <a
                href="/"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-text-light/70 transition hover:text-text-light',
                  focusRing,
                )}
              >
                <ArrowLeft size={15} />
                Back to the site
              </a>
            </p>
          )}

          <p className="mt-4 text-center text-xs text-text-light/65">
            Changes you make here publish to calabatherapy.com.
          </p>
        </div>
      </PanelChrome>
    </motion.div>
  );

  if (overlay) {
    return (
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Session ended — sign in again"
      >
        {card}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden p-4 sm:p-6">
      <AuroraField variant="adminLogin" />
      <AuroraRibbon
        mode="echo"
        echoOpacity={0.12}
        className="absolute z-0 w-[min(130vw,1800px)] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      />
      <ParticleField density={70} seed={12} shootingStars parallax />
      {card}
    </div>
  );
}

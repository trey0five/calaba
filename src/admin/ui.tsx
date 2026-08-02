import {
  createContext,
  MutableRefObject,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { easeOutExpo, usePrefersReducedMotion } from '@/lib/motion';
import { AVATAR_GRADIENTS, fieldBase, PANEL_BLOOMS, PanelChrome } from '@/lib/ui';
import type { ApplicationStatus, ReviewStatus } from './types';

/* ------------------------------------------------------------------ *
 * Palette — one accent hue per area, focus rings stay teal everywhere.
 * Tailwind can't build class names at runtime, so every variant is
 * spelled out.
 * ------------------------------------------------------------------ */

export type Hue = 'gold' | 'magenta' | 'teal' | 'coral';

export const HUES: Record<
  Hue,
  { hex: string; text: string; bgSoft: string; ring: string; chip: string; gradient: string }
> = {
  gold: {
    hex: '#FFC44D',
    text: 'text-gold-bright',
    bgSoft: 'bg-gold-bright/15',
    ring: 'ring-gold-bright/30',
    chip: 'bg-gold-bright/15 text-gold-bright ring-1 ring-gold-bright/30',
    gradient: 'linear-gradient(135deg, #FFC44D 0%, #B07C0F 100%)',
  },
  magenta: {
    hex: '#FF6FB0',
    text: 'text-magenta-bright',
    bgSoft: 'bg-magenta-bright/15',
    ring: 'ring-magenta-bright/30',
    // #FF6FB0 on the /15 fill fell short of 4.5:1; #FFA8D0 on a /20 fill clears
    // it while reading as the same magenta chip.
    chip: 'bg-magenta-bright/20 text-[#FFA8D0] ring-1 ring-magenta-bright/30',
    gradient: 'linear-gradient(135deg, #FF6FB0 0%, #9C1F5B 100%)',
  },
  teal: {
    hex: '#2FE0D8',
    text: 'text-teal-bright',
    bgSoft: 'bg-teal-bright/15',
    ring: 'ring-teal-bright/30',
    chip: 'bg-teal-bright/15 text-teal-bright ring-1 ring-teal-bright/30',
    gradient: 'linear-gradient(135deg, #2FE0D8 0%, #0E5A56 100%)',
  },
  coral: {
    hex: '#FF8A6E',
    text: 'text-coral-bright',
    bgSoft: 'bg-coral-bright/15',
    ring: 'ring-coral-bright/30',
    chip: 'bg-coral-bright/15 text-coral-bright ring-1 ring-coral-bright/30',
    gradient: 'linear-gradient(135deg, #FF8A6E 0%, #B8451F 100%)',
  },
};

/* ------------------------------ recipes ---------------------------- */

export const glassCard =
  'relative rounded-2xl bg-white/[0.07] ring-1 ring-white/15 backdrop-blur-sm p-5 sm:p-6';

/**
 * Keyboard focus indicator. Appended to every interactive recipe — without it
 * a keyboard-only admin has no idea where they are on any screen.
 */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-bright/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950';

export const btnGold =
  'inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-[15px] font-semibold text-ink transition hover:scale-[1.03] hover:shadow-glow-gold disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-none ' +
  focusRing;

export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-6 py-3 text-[15px] font-semibold text-text-light ring-1 ring-white/40 backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60 ' +
  focusRing;

export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-coral-bright ring-1 ring-coral-bright/40 transition hover:bg-coral-bright/10 disabled:cursor-not-allowed disabled:opacity-60 ' +
  focusRing;

export const btnDangerSolid =
  'inline-flex items-center justify-center gap-2 rounded-full bg-coral-bright px-6 py-3 text-[15px] font-semibold text-ink transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 ' +
  focusRing;

export const iconBtn =
  'grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink-950/70 text-white/80 ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15 hover:text-white ' +
  focusRing;

/**
 * Meta type (dates, filenames, captions). /50 on this background sits under
 * 4.5:1; /65 clears it without changing the visual hierarchy.
 */
export const metaText = 'text-xs text-text-light/65';

/* --------------------------- modal layering ------------------------ */

/**
 * Esc must only reach the TOP-most layer. Before this, one Esc keypress
 * dismissed the ConfirmDialog *and* the Drawer sitting behind it, throwing
 * away whatever draft was in the drawer.
 */
const modalStack: symbol[] = [];

export function useModalLayer(active: boolean) {
  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol('modal-layer');

  useEffect(() => {
    if (!active) return;
    const id = idRef.current as symbol;
    modalStack.push(id);
    return () => {
      const at = modalStack.lastIndexOf(id);
      if (at >= 0) modalStack.splice(at, 1);
    };
  }, [active]);

  return useCallback(
    () => modalStack.length === 0 || modalStack[modalStack.length - 1] === idRef.current,
    [],
  );
}

/** Tab cycles inside `panelRef` only. Shared by the drawer, the confirm
 *  dialog and the re-auth overlay so all three behave identically. */
export function useFocusTrap(
  active: boolean,
  panelRef: RefObject<HTMLElement> | MutableRefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([type="file"]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
        // `offsetParent` is null for anything inside a fixed-position ancestor,
        // so visibility is measured by box size instead.
      ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, panelRef]);
}

/** Freezes the page behind a modal, compensating for the scrollbar. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [active]);
}

/** Gradient hairline frame — marks a card as live on the public site. */
export function GradientFrame({ className }: { className?: string }) {
  return (
    <div
      className={cn('pointer-events-none absolute -inset-px rounded-[26px] opacity-70', className)}
      style={{
        background:
          'linear-gradient(135deg, rgba(47,224,216,0.55), rgba(255,111,176,0.45) 45%, rgba(255,196,77,0.5))',
      }}
      aria-hidden="true"
    />
  );
}

/* ------------------------------ helpers ---------------------------- */

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function avatarGradient(seed: string) {
  let acc = 0;
  for (let i = 0; i < seed.length; i++) acc = (acc + seed.charCodeAt(i)) % 997;
  return AVATAR_GRADIENTS[acc % AVATAR_GRADIENTS.length];
}

export function relativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fullDate(iso: string | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Avatar / role medallion. */
export function Medallion({
  label,
  gradient,
  size = 'md',
  className,
}: {
  label: ReactNode;
  gradient: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-bold text-white ring-1 ring-white/20',
        dims,
        className,
      )}
      style={{ background: gradient }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

/* ------------------------------- pills ----------------------------- */

const REVIEW_PILL: Record<ReviewStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gold-bright/15 text-gold-bright ring-gold-bright/30' },
  approved: {
    label: 'Published',
    className: 'bg-teal-bright/15 text-teal-bright ring-teal-bright/30',
  },
  rejected: {
    label: 'Archived',
    className: 'bg-white/[0.07] text-text-light-muted ring-white/15',
  },
};

const APPLICATION_PILL: Record<ApplicationStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-coral-bright/15 text-coral-bright ring-coral-bright/30' },
  reviewed: { label: 'Reviewed', className: 'bg-gold-bright/15 text-gold-bright ring-gold-bright/30' },
  contacted: {
    label: 'Contacted',
    className: 'bg-teal-bright/15 text-teal-bright ring-teal-bright/30',
  },
  rejected: {
    label: 'Not moving forward',
    className: 'bg-white/[0.07] text-text-light-muted ring-white/15',
  },
};

export function StatusPill({
  kind,
  status,
  className,
}: {
  kind: 'review' | 'application';
  status: ReviewStatus | ApplicationStatus;
  className?: string;
}) {
  const spec =
    kind === 'review'
      ? REVIEW_PILL[status as ReviewStatus]
      : APPLICATION_PILL[status as ApplicationStatus];
  if (!spec) return null;
  return (
    <motion.span
      layout
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1',
        spec.className,
        className,
      )}
    >
      {spec.label}
    </motion.span>
  );
}

export function ConsentBadge({ consent }: { consent: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1',
        consent
          ? 'bg-teal-bright/15 text-teal-bright ring-teal-bright/30'
          : 'bg-white/[0.07] text-text-light/60 ring-white/15',
      )}
    >
      {consent ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
      {consent ? 'Consent to publish' : 'Private feedback only'}
    </span>
  );
}

/* ----------------------------- structure --------------------------- */

export function PageHeader({
  eyebrow,
  hue,
  title,
  sub,
  actions,
}: {
  eyebrow: string;
  hue: Hue;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span
          className={cn(
            'text-[11px] font-bold uppercase tracking-[0.16em]',
            HUES[hue].text,
          )}
        >
          {eyebrow}
        </span>
        <h1
          className="mt-2 font-bold tracking-tight text-text-light"
          style={{ fontSize: 'clamp(24px, 3vw, 32px)' }}
        >
          {title}
        </h1>
        {sub && <p className="mt-1.5 text-sm text-text-light/70">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export function PageEnter({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <div>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easeOutExpo }}
    >
      {children}
    </motion.div>
  );
}

export interface TabSpec<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  layoutId,
}: {
  tabs: TabSpec<T>[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="flex w-full gap-1 overflow-x-auto rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 scrollbar-hide sm:w-auto">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-pressed={active}
            className={cn(
              'relative shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition',
              // Transparent expander to a 44px touch target, drawn size unchanged.
              "before:absolute before:left-0 before:top-1/2 before:h-11 before:w-full before:-translate-y-1/2 before:content-['']",
              focusRing,
              active ? 'text-text-light' : 'text-text-light/60 hover:text-text-light/85',
            )}
          >
            {active && !reduced && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/15"
                transition={{ duration: 0.35, ease: easeOutExpo }}
              />
            )}
            {active && reduced && (
              <span className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/15" />
            )}
            <span className="relative">
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className={cn('ml-1.5 text-xs', active ? 'text-text-light/70' : 'text-text-light/65')}>
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon,
  hue,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  hue: Hue;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span
        className={cn(
          'animate-float grid h-14 w-14 place-items-center rounded-full ring-1',
          HUES[hue].bgSoft,
          HUES[hue].ring,
          HUES[hue].text,
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <p className="mt-5 text-lg font-semibold text-text-light">{title}</p>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-text-light/70">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-skeleton rounded-2xl bg-white/[0.06]', className)}
      aria-hidden="true"
    />
  );
}

export function SkeletonRows({ count = 4, height = 'h-24' }: { count?: number; height?: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  );
}

/** In-button spinner + verb, never a bare spinner. */
export function Working({ label }: { label: string }) {
  return (
    <>
      <Loader2 size={17} className="animate-spin" />
      {label}
    </>
  );
}

/* ------------------------------- toasts ---------------------------- */

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  tone: 'success' | 'error' | 'info';
  title: string;
  body?: string;
  action?: ToastAction;
  href?: { label: string; url: string };
}

interface ToastContextValue {
  push: (t: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);
  const reduced = usePrefersReducedMotion();

  // Pending auto-dismiss timers must not outlive the provider — on sign-out the
  // tree unmounts and every queued setState would warn (and leak).
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    },
    [],
  );

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = nextId.current++;
    // Max three on screen — the oldest falls off the top of the stack.
    setToasts((list) => [...list, { ...t, id }].slice(-3));
    const handle = window.setTimeout(() => {
      timers.current = timers.current.filter((x) => x !== handle);
      setToasts((list) => list.filter((x) => x.id !== id));
    }, TOAST_MS);
    timers.current.push(handle);
    return id;
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* aria-live lives on the PERSISTENT container below. Announcing from the
          items themselves is unreliable: a region that appears at the same
          moment its content does is usually skipped by screen readers. */}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-20 right-4 z-[120] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6"
          role="status"
          aria-live="polite"
          aria-atomic="false"
        >
          <AnimatePresence initial={false}>
            {toasts.map((t, i) => (
              <motion.div
                key={t.id}
                layout
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={
                  reduced
                    ? undefined
                    : { opacity: 1, y: 0, scale: i < toasts.length - 1 ? 0.96 : 1 }
                }
                exit={reduced ? undefined : { opacity: 0, y: 8 }}
                transition={{ duration: 0.3, ease: easeOutExpo }}
                className="pointer-events-auto relative w-[min(92vw,22rem)] overflow-hidden rounded-2xl bg-ink-950/85 p-4 pr-11 ring-1 ring-white/15 shadow-cosmic backdrop-blur"
                role={t.tone === 'error' ? 'alert' : undefined}
              >
                <p
                  className={cn(
                    'text-sm font-semibold',
                    t.tone === 'error'
                      ? 'text-coral-bright'
                      : t.tone === 'success'
                        ? 'text-teal-bright'
                        : 'text-text-light',
                  )}
                >
                  {t.title}
                </p>
                {t.body && <p className="mt-1 text-[13px] leading-relaxed text-text-light/70">{t.body}</p>}
                {(t.action || t.href) && (
                  <div className="mt-2.5 flex items-center gap-4">
                    {t.action && (
                      <button
                        type="button"
                        onClick={() => {
                          t.action?.onClick();
                          dismiss(t.id);
                        }}
                        className="text-[13px] font-bold text-gold-bright underline underline-offset-2 hover:text-gold"
                      >
                        {t.action.label}
                      </button>
                    )}
                    {t.href && (
                      <a
                        href={t.href.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13px] font-semibold text-teal-bright underline underline-offset-2"
                      >
                        {t.href.label}
                      </a>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={14} />
                </button>
                <motion.span
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-gold"
                  initial={reduced ? false : { scaleX: 1 }}
                  animate={reduced ? undefined : { scaleX: 0 }}
                  transition={{ duration: TOAST_MS / 1000, ease: 'linear' }}
                  style={{ transformOrigin: 'left' }}
                  aria-hidden="true"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

/* --------------------------- confirm dialog ------------------------ */

export interface ConfirmSpec {
  title: string;
  /** names the exact object being acted on */
  body: ReactNode;
  confirmLabel: string;
  /** require the word DELETE to be typed before the action arms */
  requireTyped?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({ spec, onClose }: { spec: ConfirmSpec | null; onClose: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const isTopLayer = useModalLayer(!!spec);
  useScrollLock(!!spec);
  useFocusTrap(!!spec, panelRef);

  useEffect(() => {
    if (!spec) return;
    setTyped('');
    setBusy(false);
    returnFocusRef.current = document.activeElement;
    // Cancel is the default action — a mis-tapped Enter must never destroy data.
    const t = window.setTimeout(() => cancelRef.current?.focus(), 80);
    return () => {
      window.clearTimeout(t);
      (returnFocusRef.current as HTMLElement | null)?.focus?.();
    };
  }, [spec]);

  useEffect(() => {
    if (!spec) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Only the top-most layer answers Esc, so closing this dialog never also
      // closes the drawer underneath it (and discards its draft).
      if (e.key === 'Escape' && isTopLayer()) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [spec, onClose, isTopLayer]);

  const armed = !spec?.requireTyped || typed.trim() === spec.requireTyped;

  return createPortal(
    <AnimatePresence>
      {spec && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            className="fixed inset-0 bg-ink-950/70 backdrop-blur-sm"
            initial={reduced ? false : { opacity: 0 }}
            animate={reduced ? undefined : { opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <PanelChrome
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-md"
            blooms={PANEL_BLOOMS.gold}
            initial={reduced ? false : { opacity: 0, y: 24, scale: 0.96 }}
            animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.32, ease: easeOutExpo }}
          >
            <div className="relative z-10 p-6 sm:p-7">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-coral-bright/15 text-coral-bright ring-1 ring-coral-bright/35">
                <AlertTriangle size={22} />
              </span>
              <h2 id="confirm-title" className="mt-4 text-xl font-bold tracking-tight text-text-light">
                {spec.title}
              </h2>
              <div className="mt-2 text-[15px] leading-relaxed text-text-light/80">{spec.body}</div>

              {spec.requireTyped && (
                <div className="mt-4">
                  <label
                    htmlFor="confirm-typed"
                    className="mb-1.5 block text-[13px] font-semibold text-text-light"
                  >
                    Type <span className="font-mono text-coral-bright">{spec.requireTyped}</span> to
                    confirm
                  </label>
                  <input
                    id="confirm-typed"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    className={fieldBase}
                  />
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button ref={cancelRef} type="button" onClick={onClose} className={btnGhost}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!armed || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await spec.onConfirm();
                      onClose();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={btnDangerSolid}
                >
                  {busy ? <Working label="Working…" /> : spec.confirmLabel}
                </button>
              </div>
            </div>
          </PanelChrome>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Small hook so screens can drive one ConfirmDialog instance. */
export function useConfirm() {
  const [spec, setSpec] = useState<ConfirmSpec | null>(null);
  const dialog = <ConfirmDialog spec={spec} onClose={() => setSpec(null)} />;
  return { confirm: setSpec, dialog };
}

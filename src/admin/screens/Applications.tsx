import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Inbox,
  Mail,
  MapPin,
  Phone,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { easeOutExpo, usePrefersReducedMotion } from '@/lib/motion';
import { PANEL_BLOOMS } from '@/lib/ui';
import * as api from '../adminApi';
import { useAuth } from '../auth';
import { useAdminData } from '../data';
import { adminHref, navigate, useAdminRoute } from '../router';
import Drawer from '../components/Drawer';
import type { AdminApplication, ApplicationStatus } from '../types';
import {
  btnDanger,
  btnGhost,
  btnGold,
  EmptyState,
  focusRing,
  fullDate,
  glassCard,
  HUES,
  Hue,
  Medallion,
  PageEnter,
  PageHeader,
  relativeTime,
  SegmentedTabs,
  SkeletonRows,
  StatusPill,
  useConfirm,
  useToast,
  Working,
} from '../ui';

type TabValue = ApplicationStatus | 'all';

const POSITION_HUE: Record<string, Hue> = {
  RBT: 'teal',
  BCaBA: 'magenta',
  BCBA: 'gold',
};

const POSITIONS = ['All', 'RBT', 'BCaBA', 'BCBA'];

/** `tel:` with nothing after it is a dead link — offer nothing instead. */
const telHref = (phone?: string) => {
  const digits = (phone || '').replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 7 ? `tel:${digits}` : null;
};

/** Only a PDF is served inline; everything else downloads. */
const isPdf = (filename?: string) => /\.pdf$/i.test(filename || '');

const STEPS: ApplicationStatus[] = ['new', 'reviewed', 'contacted'];
const STEP_LABEL: Record<ApplicationStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  contacted: 'Contacted',
  rejected: 'Not moving forward',
};

function Section({
  title,
  hue,
  children,
}: {
  title: string;
  hue: Hue;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white/[0.05] p-5 ring-1 ring-white/10">
      <p className={cn('text-[11px] font-bold uppercase tracking-[0.16em]', HUES[hue].text)}>
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.06] py-2 last:border-0">
      <span className="text-xs text-text-light/65">{label}</span>
      <span className="text-sm font-medium text-text-light">{value || '—'}</span>
    </div>
  );
}

export default function Applications() {
  const route = useAdminRoute();
  const { authed } = useAuth();
  const { applications, loading, setApplications, logActivity } = useAdminData();
  const { push } = useToast();
  const { confirm, dialog } = useConfirm();
  const reduced = usePrefersReducedMotion();

  const [tab, setTab] = useState<TabValue>((route.query.status as TabValue) || 'new');
  const [position, setPosition] = useState('All');
  const [resumeBusy, setResumeBusy] = useState(false);
  const autoMarked = useRef<Set<string>>(new Set());

  useEffect(() => {
    const q = route.query.status as TabValue | undefined;
    if (q && ['new', 'reviewed', 'contacted', 'rejected', 'all'].includes(q)) setTab(q);
    // Only react to an incoming deep link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.query.status]);

  const selected = useMemo(
    () => applications.find((a) => a.id === route.id) ?? null,
    [applications, route.id],
  );

  const counts = useMemo(() => {
    const base: Record<string, number> = { new: 0, reviewed: 0, contacted: 0, rejected: 0 };
    applications.forEach((a) => {
      base[a.status] = (base[a.status] ?? 0) + 1;
    });
    return base;
  }, [applications]);

  const visible = useMemo(
    () =>
      applications
        .filter((a) => (tab === 'all' ? true : a.status === tab))
        .filter((a) => (position === 'All' ? true : a.values.position === position))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [applications, tab, position],
  );

  const patchStatus = (id: string, status: ApplicationStatus) =>
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));

  const setStatus = async (
    app: AdminApplication,
    next: ApplicationStatus,
    opts: { silent?: boolean; undo?: boolean } = {},
  ) => {
    const previous = app.status;
    if (previous === next) return;
    patchStatus(app.id, next);
    try {
      await authed((t) => api.updateApplication(t, app.id, next));
      if (!opts.silent) {
        logActivity(`Marked ${app.values.name}’s application ${STEP_LABEL[next]}`, 'coral');
      }
      if (opts.undo) {
        push({
          tone: 'info',
          title: `Marked as ${STEP_LABEL[next].toLowerCase()}`,
          body: `${app.values.name}’s application.`,
          action: {
            label: 'Undo',
            onClick: () => {
              patchStatus(app.id, previous);
              authed((t) => api.updateApplication(t, app.id, previous)).catch(() => {
                patchStatus(app.id, next);
              });
            },
          },
        });
      }
    } catch {
      patchStatus(app.id, previous);
      push({ tone: 'error', title: 'That status didn’t save', body: 'The change was rolled back.' });
    }
  };

  /* Opening a brand-new application marks it reviewed after 3s, with an undo. */
  useEffect(() => {
    if (!selected || selected.status !== 'new' || autoMarked.current.has(selected.id)) return;
    const id = selected.id;
    const app = selected;
    const timer = window.setTimeout(() => {
      autoMarked.current.add(id);
      setStatus(app, 'reviewed', { silent: true, undo: true });
    }, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.status]);

  const openResume = async (app: AdminApplication) => {
    setResumeBusy(true);
    try {
      // Minted fresh every time — presigned links expire and are never emailed.
      const ticket = await authed((t) => api.getResumeUrl(t, app.id));
      // A programmatic anchor rather than window.open: Safari blocks a popup
      // opened after an await (the user-gesture token has expired by then), so
      // the button appeared to do nothing at all.
      const a = document.createElement('a');
      a.href = ticket.url;
      a.rel = 'noopener';
      a.target = '_blank';
      // Only a PDF renders inline; anything else is served as an attachment, so
      // ask the browser to download it rather than navigate to it.
      if (!ticket.inline) a.download = ticket.filename || 'resume';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      push({
        tone: 'error',
        title: 'Couldn’t open that résumé',
        body: err instanceof api.ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setResumeBusy(false);
    }
  };

  const removeApplication = async (app: AdminApplication) => {
    const snapshot = applications;
    setApplications((prev) => prev.filter((a) => a.id !== app.id));
    navigate('applications');
    try {
      await authed((t) => api.deleteApplication(t, app.id));
      logActivity(`Deleted ${app.values.name}’s application`, 'coral');
      push({ tone: 'info', title: 'Application deleted' });
    } catch {
      setApplications(() => snapshot);
      push({ tone: 'error', title: 'Couldn’t delete that application' });
    }
  };

  return (
    <PageEnter>
      <PageHeader
        eyebrow="Hiring"
        hue="coral"
        title={
          <>
            Job <span className="brand-gradient-text-bright">applications</span>
          </>
        }
        sub="Everyone who applied through the careers section."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedTabs
          layoutId="applications-tab"
          value={tab}
          onChange={(v) => setTab(v)}
          tabs={[
            { value: 'new', label: 'New', count: counts.new },
            { value: 'reviewed', label: 'Reviewed', count: counts.reviewed },
            { value: 'contacted', label: 'Contacted', count: counts.contacted },
            { value: 'rejected', label: 'Archived', count: counts.rejected },
            { value: 'all', label: 'All', count: applications.length },
          ]}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {POSITIONS.map((p) => {
          const hue = POSITION_HUE[p];
          const active = position === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPosition(p)}
              aria-pressed={active}
              className={cn(
                // `before:` expander gives a 44px touch target without changing
                // the chip's drawn size.
                'relative rounded-full px-4 py-1.5 text-[13px] font-semibold ring-1 transition',
                'before:absolute before:left-0 before:top-1/2 before:h-11 before:w-full before:-translate-y-1/2 before:content-[\'\']',
                focusRing,
                active && hue
                  ? cn(HUES[hue].bgSoft, HUES[hue].text, HUES[hue].ring)
                  : active
                    ? 'bg-white/15 text-text-light ring-white/25'
                    : 'bg-white/[0.06] text-text-light/60 ring-white/10 hover:text-text-light',
              )}
            >
              {p}
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonRows count={4} height="h-20" />
      ) : visible.length === 0 ? (
        <div className={glassCard}>
          <EmptyState
            icon={<Inbox size={22} />}
            hue="coral"
            title="No applications here"
            body="Applications submitted from the careers section land here with the applicant's résumé attached."
          />
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {visible.map((app) => {
              const hue = POSITION_HUE[app.values.position] ?? 'coral';
              const isNew = app.status === 'new';
              return (
                <motion.li
                  key={app.id}
                  layout={!reduced}
                  exit={reduced ? undefined : { opacity: 0, height: 0, marginBottom: 0 }}
                >
                  <a
                    href={adminHref('applications', app.id)}
                    className={cn(
                      'relative flex items-center gap-4 overflow-hidden rounded-2xl bg-white/[0.07] px-5 py-4 ring-1 ring-white/15 transition hover:bg-white/[0.1]',
                    )}
                  >
                    {isNew && (
                      <span
                        className="absolute inset-y-0 left-0 w-[3px]"
                        style={{ background: HUES.coral.hex }}
                        aria-hidden="true"
                      />
                    )}
                    <Medallion
                      label={app.values.position || '?'}
                      gradient={HUES[hue].gradient}
                      className="text-[11px]"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate font-semibold',
                          isNew ? 'text-white' : 'text-text-light/85',
                        )}
                      >
                        {app.values.name}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-text-light/60">
                        {[app.values.city, app.values.region].filter(Boolean).join(', ')}
                        {app.values.wage && (
                          <>
                            {' · '}
                            <span className="font-semibold text-gold-bright">{app.values.wage}</span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-xs text-text-light/65 sm:block">
                      {relativeTime(app.createdAt)}
                    </span>
                    <StatusPill kind="application" status={app.status} className="hidden sm:inline-flex" />
                    <ChevronRight size={17} className="shrink-0 text-text-light/40" />
                  </a>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <Drawer
        open={!!selected}
        onClose={() => navigate('applications')}
        title={selected?.values.name ?? 'Application'}
        width={520}
        mobile="full"
        blooms={PANEL_BLOOMS.application}
        footer={
          selected ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  confirm({
                    title: 'Delete this application?',
                    body: (
                      <>
                        <strong className="text-text-light">{selected.values.name}</strong>’s
                        application will be permanently deleted, and their résumé file will be
                        erased from storage — every saved version of it, not just the current
                        one. This cannot be undone.
                      </>
                    ),
                    confirmLabel: 'Delete forever',
                    requireTyped: 'DELETE',
                    onConfirm: () => removeApplication(selected),
                  })
                }
                className={cn(btnDanger, 'px-4')}
                aria-label="Delete application"
              >
                <Trash2 size={16} />
              </button>
              {telHref(selected.values.phone) ? (
                <a
                  href={telHref(selected.values.phone) as string}
                  className={cn(btnGhost, 'flex-1 sm:flex-none')}
                >
                  <Phone size={16} />
                  Call
                </a>
              ) : (
                <span
                  className={cn(btnGhost, 'flex-1 cursor-not-allowed opacity-60 sm:flex-none')}
                  aria-disabled="true"
                >
                  <Phone size={16} />
                  No phone
                </span>
              )}
              <a
                href={`mailto:${selected.values.email}?subject=${encodeURIComponent(
                  `Your CAL-ABA application — ${selected.values.position || ''}`.trim(),
                )}`}
                className={cn(btnGold, 'flex-1 sm:flex-none')}
              >
                <Mail size={16} />
                Email
              </a>
            </div>
          ) : null
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* Status stepper */}
            <div className="flex flex-wrap items-center gap-2">
              {STEPS.map((step) => {
                const active = selected.status === step;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setStatus(selected, step)}
                    // The stepper exposed no state at all to assistive tech —
                    // every step read as an identical plain button.
                    aria-current={active ? 'true' : undefined}
                    aria-label={`Mark as ${STEP_LABEL[step]}`}
                    className={cn(
                      'relative rounded-full px-4 py-1.5 text-[13px] font-semibold transition',
                      'before:absolute before:left-0 before:top-1/2 before:h-11 before:w-full before:-translate-y-1/2 before:content-[\'\']',
                      focusRing,
                      active ? 'text-ink' : 'text-text-light/65 ring-1 ring-white/15 hover:text-text-light',
                    )}
                  >
                    {active &&
                      (reduced ? (
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ background: HUES.coral.hex }}
                        />
                      ) : (
                        <motion.span
                          layoutId="app-step"
                          className="absolute inset-0 rounded-full"
                          style={{ background: HUES.coral.hex }}
                          transition={{ duration: 0.35, ease: easeOutExpo }}
                        />
                      ))}
                    <span className="relative">{STEP_LABEL[step]}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  setStatus(selected, selected.status === 'rejected' ? 'reviewed' : 'rejected', {
                    undo: true,
                  })
                }
                aria-pressed={selected.status === 'rejected'}
                className={cn(
                  'relative ml-auto rounded-full px-4 py-1.5 text-[13px] font-semibold ring-1 transition',
                  'before:absolute before:left-0 before:top-1/2 before:h-11 before:w-full before:-translate-y-1/2 before:content-[\'\']',
                  focusRing,
                  selected.status === 'rejected'
                    ? 'bg-coral-bright/15 text-coral-bright ring-coral-bright/40'
                    : 'text-coral-bright ring-coral-bright/40 hover:bg-coral-bright/10',
                )}
              >
                {selected.status === 'rejected' ? 'Archived' : 'Not moving forward'}
              </button>
            </div>

            <p className="text-xs text-text-light/65">
              Applied {fullDate(selected.createdAt)} · {relativeTime(selected.createdAt)}
            </p>

            <Section title="Contact" hue="teal">
              <div className="space-y-2.5">
                {telHref(selected.values.phone) ? (
                  <a
                    href={telHref(selected.values.phone) as string}
                    className={cn(
                      'flex items-center gap-3 rounded-lg text-[15px] font-semibold text-text-light transition hover:text-magenta-bright',
                      focusRing,
                    )}
                  >
                    <Phone size={17} className="text-magenta-bright" />
                    {selected.values.phone}
                  </a>
                ) : (
                  <p className="flex items-center gap-3 text-[15px] font-semibold text-text-light/70">
                    <Phone size={17} className="text-magenta-bright" />
                    No phone number given
                  </p>
                )}
                <a
                  href={`mailto:${selected.values.email}`}
                  className="flex items-center gap-3 break-all text-[15px] font-semibold text-text-light transition hover:text-teal-bright"
                >
                  <Mail size={17} className="shrink-0 text-teal-bright" />
                  {selected.values.email || '—'}
                </a>
              </div>
            </Section>

            <Section title="Address" hue="magenta">
              <p className="flex gap-3 text-sm leading-relaxed text-text-light/85">
                <MapPin size={17} className="mt-0.5 shrink-0 text-magenta-bright" />
                <span>
                  {selected.values.street && (
                    <>
                      {selected.values.street}
                      <br />
                    </>
                  )}
                  {[selected.values.city, selected.values.region].filter(Boolean).join(', ')}
                  <br />
                  {[selected.values.postal, selected.values.country].filter(Boolean).join(' ')}
                </span>
              </p>
            </Section>

            <Section title="Details" hue="gold">
              <Row label="Position" value={selected.values.position} />
              <Row label="Date of birth" value={selected.values.dob} />
              <Row
                label="Desired wage"
                value={<span className="text-gold-bright">{selected.values.wage}</span>}
              />
              <div className="pt-3">
                {selected.values.rightToWork === 'Yes' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-bright/15 px-3 py-1 text-xs font-semibold text-teal-bright ring-1 ring-teal-bright/30">
                    <CheckCircle2 size={13} />
                    Can prove right to work in the US
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-bright/15 px-3 py-1 text-xs font-semibold text-coral-bright ring-1 ring-coral-bright/30">
                    <AlertTriangle size={13} />
                    Cannot prove right to work in the US
                  </span>
                )}
              </div>
            </Section>

            <Section title="References" hue="teal">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-light/85">
                {selected.values.references || '—'}
              </p>
            </Section>

            <Section title="Résumé" hue="gold">
              {selected.resume?.key || selected.resume?.filename ? (
                <button
                  type="button"
                  onClick={() => openResume(selected)}
                  disabled={resumeBusy}
                  className={btnGold}
                >
                  {resumeBusy ? (
                    <Working label="Preparing…" />
                  ) : isPdf(selected.resume?.filename) ? (
                    <>
                      <ExternalLink size={16} />
                      Open résumé
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Download résumé
                    </>
                  )}
                </button>
              ) : (
                <button type="button" disabled className={cn(btnGhost, 'cursor-not-allowed')}>
                  No résumé attached
                </button>
              )}
              {selected.resume?.filename && (
                <p className="mt-2 truncate text-xs text-text-light/65">
                  {selected.resume.filename}
                </p>
              )}
            </Section>
          </div>
        )}
      </Drawer>

      {dialog}
    </PageEnter>
  );
}

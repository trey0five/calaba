import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EyeOff, Info, Pencil, Quote, Star, Trash2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { easeOutExpo, usePrefersReducedMotion } from '@/lib/motion';
import { fieldBase, Label, PANEL_BLOOMS, Select } from '@/lib/ui';
import Drawer from '../components/Drawer';
import * as api from '../adminApi';
import { useAuth } from '../auth';
import { useAdminData } from '../data';
import { useAdminRoute } from '../router';
import type { AdminReview, ReviewAudience, ReviewDisplay, ReviewStatus } from '../types';
import {
  avatarGradient,
  btnDanger,
  btnGhost,
  btnGold,
  ConsentBadge,
  EmptyState,
  fullDate,
  glassCard,
  GradientFrame,
  HUES,
  initialsOf,
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

type SortKey = 'newest' | 'oldest' | 'rating';
/** 'all' is a UI-only value — the API only knows 'family' and 'staff'. */
type AudienceFilter = 'all' | ReviewAudience;

/**
 * The ONE reader of `audience`, mirroring `audience_of()` on the server.
 * Anything that is not exactly 'staff' — including the field being absent on
 * the four imported samples — is a family review.
 */
function audienceOf(review: AdminReview): ReviewAudience {
  return review.audience === 'staff' ? 'staff' : 'family';
}

/** The real full name, admin-only. Never rendered on the public site. */
function realName(review: AdminReview): string {
  const s = review.submission;
  return (audienceOf(review) === 'staff' ? s.fullName : s.name) || '';
}

const TAB_EMPTY: Record<ReviewStatus, { title: string; body: string }> = {
  pending: {
    title: 'No reviews waiting',
    body: 'When a family submits a review from the site it lands here for your approval before anything goes public.',
  },
  approved: {
    title: 'Nothing published yet',
    body: 'Approved reviews appear on the homepage carousel. Until then the site shows the bundled sample quotes.',
  },
  rejected: {
    title: 'Nothing archived',
    body: 'Reviews you archive are kept here so you can restore them later.',
  },
};

const TEAM_TAB_EMPTY: Record<ReviewStatus, { title: string; body: string }> = {
  pending: {
    title: 'No team reviews waiting',
    body: 'When a current or former team member reviews working here it lands in this list for your approval.',
  },
  approved: {
    title: 'No team reviews published',
    body: 'Approved team reviews appear in the “What our team says” block on the careers section.',
  },
  rejected: {
    title: 'Nothing archived',
    body: 'Team reviews you archive are kept here so you can restore them later.',
  },
};

function Stars({ rating }: { rating: number }) {
  return (
    // Without role="img" the label is dropped: a bare <span> has no role for
    // an accessible name to attach to, so the rating was announced as nothing.
    <span className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={15}
          className={i < rating ? 'fill-gold text-gold' : 'text-white/20'}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(btnGhost, 'w-full sm:w-auto')}>
      <Pencil size={16} />
      Edit
    </button>
  );
}

/** The published copy, held as strings while it is being edited. */
interface DisplayDraft {
  id: string;
  audience: ReviewAudience;
  quote: string;
  /** read-only for a team review — the server derives it from the full name */
  attribution: string;
  location: string;
  service: string;
  role: string;
  tenure: string;
  relationship: string;
  initials: string;
  rating: number;
}

const MAX_INITIALS = 3;

/**
 * A compact restatement of the public carousel card (see
 * components/sections/Testimonials.tsx) so the owner is editing something that
 * looks like what visitors will read, not a form.
 */
function HomepagePreview({ draft, seed }: { draft: DisplayDraft; seed: string }) {
  const gradient = avatarGradient(seed);
  return (
    <div className="relative rounded-[18px] bg-bg-deep p-px">
      <div
        className="pointer-events-none absolute inset-0 rounded-[18px] opacity-70"
        style={{
          background:
            'linear-gradient(135deg, rgba(47,224,216,0.55), rgba(255,111,176,0.45) 45%, rgba(255,196,77,0.5))',
        }}
        aria-hidden="true"
      />
      <div className="relative rounded-[17px] bg-[#140A2E] px-5 py-5">
        <Quote size={30} className="absolute right-4 top-3 text-gold/20" aria-hidden="true" />
        <span className="flex gap-0.5" role="img" aria-label={`${draft.rating} out of 5 stars`}>
          {Array.from({ length: Math.max(1, Math.min(5, draft.rating)) }, (_, i) => (
            <Star key={i} size={13} className="fill-gold text-gold" aria-hidden="true" />
          ))}
        </span>
        <p className="mt-3 text-[14px] leading-relaxed text-text-light">
          {draft.quote.trim() || (
            <span className="text-text-light/40">The quote shows here.</span>
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white ring-1 ring-white/20"
            style={{ background: gradient }}
            aria-hidden="true"
          >
            {draft.initials.trim() || '?'}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-text-light">
              {draft.attribution.trim() || (
                <span className="text-text-light/40">No name shown</span>
              )}
            </span>
            <span className="block text-xs text-text-light/70">{draft.location}</span>
          </span>
          {draft.service.trim() && (
            <span className="ml-auto rounded-full bg-teal-bright/15 px-3 py-1 text-[11px] font-semibold text-teal-bright ring-1 ring-teal-bright/30">
              {draft.service}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The careers-page counterpart of `HomepagePreview` — a compact restatement of
 * the card in components/sections/Careers.tsx. `attribution` is shown but not
 * editable: for a team review it is always derived server-side from the stored
 * full name, so an edit here would be a lie the site would ignore.
 */
function CareersPreview({ draft, seed }: { draft: DisplayDraft; seed: string }) {
  const gradient = avatarGradient(seed);
  return (
    <div className="relative rounded-[18px] p-px" style={{ background: gradient }}>
      <div className="relative rounded-[17px] bg-[#140A2E] px-5 py-5">
        <Quote size={30} className="absolute right-4 top-3 text-gold/20" aria-hidden="true" />
        <span className="flex gap-0.5" role="img" aria-label={`${draft.rating} out of 5 stars`}>
          {Array.from({ length: Math.max(1, Math.min(5, draft.rating)) }, (_, i) => (
            <Star key={i} size={13} className="fill-gold text-gold" aria-hidden="true" />
          ))}
        </span>
        <p className="mt-3 text-[14px] leading-relaxed text-text-light">
          {draft.quote.trim() || <span className="text-text-light/40">The quote shows here.</span>}
        </p>
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white ring-1 ring-white/20"
            style={{ background: gradient }}
            aria-hidden="true"
          >
            {draft.initials.trim() || 'TM'}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-text-light">
              {draft.attribution.trim() || (
                <span className="text-text-light/40">No name shown</span>
              )}
            </span>
            <span className="block text-xs text-text-light/70">
              {[draft.role, draft.tenure, draft.relationship].filter((p) => p.trim()).join(' · ')}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Reviews() {
  const route = useAdminRoute();
  const { authed } = useAuth();
  const { reviews, loading, setReviews, logActivity } = useAdminData();
  const { push } = useToast();
  const { confirm, dialog } = useConfirm();
  const reduced = usePrefersReducedMotion();

  const [tab, setTab] = useState<ReviewStatus>(
    (route.query.status as ReviewStatus) || 'pending',
  );
  const [audience, setAudience] = useState<AudienceFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  /** A SET, not one slot: two overlapping actions used to clear each other's
   *  spinner, leaving a card that looked idle while a request was in flight. */
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const markBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  const [ringing, setRinging] = useState<string | null>(null);
  /** Cards held in their old tab for 600ms so the pill morph is visible. */
  const [pinned, setPinned] = useState<Record<string, ReviewStatus>>({});
  /** Published-copy editor. `null` = drawer closed. */
  const [draft, setDraft] = useState<DisplayDraft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    const q = route.query.status as ReviewStatus | undefined;
    if (q && q !== tab && ['pending', 'approved', 'rejected'].includes(q)) setTab(q);
    // Only react to an incoming deep link, never to local tab clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.query.status]);

  /** Status counts reflect the audience segment you are looking at. */
  const inAudience = useMemo(
    () => (audience === 'all' ? reviews : reviews.filter((r) => audienceOf(r) === audience)),
    [reviews, audience],
  );

  const counts = useMemo(
    () => ({
      pending: inAudience.filter((r) => r.status === 'pending').length,
      approved: inAudience.filter((r) => r.status === 'approved').length,
      rejected: inAudience.filter((r) => r.status === 'rejected').length,
    }),
    [inAudience],
  );

  const audienceCounts = useMemo(
    () => ({
      all: reviews.length,
      family: reviews.filter((r) => audienceOf(r) === 'family').length,
      staff: reviews.filter((r) => audienceOf(r) === 'staff').length,
    }),
    [reviews],
  );

  const visible = useMemo(() => {
    const list = inAudience.filter((r) => r.status === tab || pinned[r.id] === tab);
    const byDate = (a: AdminReview, b: AdminReview) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === 'oldest') return [...list].sort((a, b) => byDate(b, a));
    if (sort === 'rating')
      return [...list].sort(
        (a, b) => (b.submission.rating || 0) - (a.submission.rating || 0) || byDate(a, b),
      );
    return [...list].sort(byDate);
  }, [inAudience, tab, pinned, sort]);

  const patchStatus = (id: string, status: ReviewStatus) =>
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

  /** Optimistic status change with undo, ring flourish and rollback on failure. */
  const setStatus = async (
    review: AdminReview,
    next: ReviewStatus,
    opts: {
      ring?: boolean;
      toast: { title: string; body?: string };
      activity: string;
      /** where "View on the site" points once it is published */
      liveHash?: string;
    },
  ) => {
    const previous = review.status;
    markBusy(review.id, true);
    patchStatus(review.id, next);
    if (opts.ring) {
      setRinging(review.id);
      window.setTimeout(() => setRinging((id) => (id === review.id ? null : id)), 700);
    }
    // Hold the card in place briefly so the pill morph reads before it leaves.
    setPinned((p) => ({ ...p, [review.id]: previous }));
    window.setTimeout(() => {
      setPinned((p) => {
        const { [review.id]: _drop, ...rest } = p;
        return rest;
      });
    }, 600);

    try {
      await authed((t) => api.updateReview(t, review.id, { status: next }));
      logActivity(opts.activity, next === 'approved' ? 'teal' : 'magenta');
      push({
        tone: next === 'rejected' ? 'info' : 'success',
        title: opts.toast.title,
        body: opts.toast.body,
        href:
          next === 'approved'
            ? { label: 'View on the site', url: opts.liveHash || '/#voices' }
            : undefined,
        action: {
          label: 'Undo',
          onClick: () => {
            patchStatus(review.id, previous);
            authed((t) => api.updateReview(t, review.id, { status: previous })).catch(() => {
              patchStatus(review.id, next);
              push({ tone: 'error', title: 'Couldn’t undo that', body: 'Please try again.' });
            });
          },
        },
      });
    } catch (err) {
      patchStatus(review.id, previous);
      setPinned((p) => {
        const { [review.id]: _drop, ...rest } = p;
        return rest;
      });
      push({
        tone: 'error',
        title: 'That didn’t save',
        body:
          err instanceof api.ApiError && err.status === 403
            ? 'This reviewer asked for private feedback, so it can’t be published.'
            : 'The change was rolled back. Check your connection and try again.',
      });
    } finally {
      markBusy(review.id, false);
    }
  };

  const openEdit = (review: AdminReview) => {
    const d = review.display || ({} as ReviewDisplay);
    setDraft({
      id: review.id,
      audience: audienceOf(review),
      quote: d.quote || review.submission.review || '',
      attribution: d.attribution || '',
      location: d.location || '',
      service: d.service || '',
      role: d.role || review.submission.role || '',
      tenure: d.tenure || review.submission.tenure || '',
      relationship: d.relationship || review.submission.relationship || '',
      initials: d.initials || '',
      rating: Math.max(1, Math.min(5, Number(d.rating) || review.submission.rating || 5)),
    });
  };

  /**
   * Publish-copy save. Sends ONLY `{display}` — the submission the family wrote
   * is evidence and is never rewritten, and omitting `status` keeps the server
   * from re-stamping `moderation` (which would erase the imported-sample note).
   */
  const saveDraft = async () => {
    if (!draft || savingDraft) return;
    const isTeam = draft.audience === 'staff';
    const rating = Math.max(1, Math.min(5, Math.round(draft.rating) || 5));
    // A team review sends NO `attribution` and NO `initials`: the server
    // derives both from the stored full name and ignores anything a client
    // suggests, so sending them would only pretend they were editable.
    const patch: Partial<ReviewDisplay> = isTeam
      ? {
          quote: draft.quote.trim(),
          role: draft.role.trim(),
          tenure: draft.tenure.trim(),
          relationship: draft.relationship.trim(),
          rating,
        }
      : {
          quote: draft.quote.trim(),
          attribution: draft.attribution.trim(),
          location: draft.location.trim(),
          service: draft.service.trim(),
          initials: draft.initials.trim().slice(0, MAX_INITIALS),
          rating,
        };
    if (!patch.quote) {
      push({ tone: 'error', title: 'A quote is required', body: 'The card has nothing to show without it.' });
      return;
    }
    if (!isTeam && (!patch.attribution || !patch.initials)) {
      push({
        tone: 'error',
        title: 'Attribution and initials are required',
        body: 'The homepage skips any review missing either — it would render as a nameless empty circle.',
      });
      return;
    }

    const snapshot = reviews;
    const wasLive = reviews.find((r) => r.id === draft.id)?.status === 'approved';
    setSavingDraft(true);
    setReviews((prev) =>
      prev.map((r) =>
        r.id === draft.id ? { ...r, display: { ...r.display, ...patch } } : r,
      ),
    );
    try {
      const record = await authed((t) => api.updateReview(t, draft.id, { display: patch }));
      // Adopt the server's copy — it clamps and trims on its own terms.
      setReviews((prev) => prev.map((r) => (r.id === record.id ? record : r)));
      logActivity(`Edited the published text of a ${isTeam ? 'team ' : ''}review`, 'teal');
      push({
        tone: 'success',
        title: 'Published copy updated',
        body: wasLive
          ? isTeam
            ? 'The careers section shows the new wording.'
            : 'The homepage carousel shows the new wording.'
          : undefined,
        href: wasLive
          ? { label: 'View on the site', url: isTeam ? '/#careers' : '/#voices' }
          : undefined,
      });
      setDraft(null);
    } catch (err) {
      setReviews(() => snapshot);
      push({
        tone: 'error',
        title: 'That didn’t save',
        body:
          err instanceof api.ApiError
            ? `${err.message} Your edit was rolled back.`
            : 'Your edit was rolled back. Check your connection and try again.',
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const confirmDelete = (review: AdminReview, live: boolean) => {
    const team = audienceOf(review) === 'staff';
    return confirm({
      title: live ? 'Delete this review from the site?' : 'Delete this review forever?',
      body: (
        <>
          The review from{' '}
          <strong className="text-text-light">
            {realName(review) || review.display?.attribution || (team ? 'a team member' : 'a family')}
          </strong>{' '}
          {live ? (
            <>
              is{' '}
              <strong className="text-text-light">
                live on the {team ? 'careers section' : 'homepage'} right now
              </strong>{' '}
              — it disappears from the site as soon as you delete it, and it is removed
              permanently.
            </>
          ) : (
            <>will be permanently removed.</>
          )}{' '}
          This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete forever',
      requireTyped: 'DELETE',
      onConfirm: () => removeForever(review),
    });
  };

  const removeForever = async (review: AdminReview) => {
    const snapshot = reviews;
    const team = audienceOf(review) === 'staff';
    setReviews((prev) => prev.filter((r) => r.id !== review.id));
    try {
      await authed((t) => api.deleteReview(t, review.id));
      logActivity(
        `Deleted a ${team ? 'team ' : ''}review from ${
          realName(review) || (team ? 'a team member' : 'a family')
        }`,
        'coral',
      );
      push({ tone: 'info', title: 'Review deleted' });
    } catch {
      setReviews(() => snapshot);
      push({ tone: 'error', title: 'Couldn’t delete that review', body: 'Nothing was removed.' });
    }
  };

  const exitFor = (status: ReviewStatus) =>
    status === 'rejected'
      ? { opacity: 0, x: -40, transition: { duration: 0.4, ease: easeOutExpo } }
      : {
          opacity: 0,
          height: 0,
          marginBottom: 0,
          transition: { duration: 0.4, ease: easeOutExpo },
        };

  return (
    <PageEnter>
      <PageHeader
        eyebrow="Moderation"
        hue="magenta"
        title={
          audience === 'staff' ? (
            <>
              Team <span className="brand-gradient-text-bright">reviews</span>
            </>
          ) : audience === 'family' ? (
            <>
              Family <span className="brand-gradient-text-bright">reviews</span>
            </>
          ) : (
            <>
              All <span className="brand-gradient-text-bright">reviews</span>
            </>
          )
        }
        sub="Nothing appears on the site until you approve it."
      />

      <div className="mb-4">
        <SegmentedTabs
          layoutId="reviews-audience"
          value={audience}
          onChange={(v) => setAudience(v)}
          tabs={[
            { value: 'all', label: 'All', count: audienceCounts.all },
            { value: 'family', label: 'Families', count: audienceCounts.family },
            { value: 'staff', label: 'Team', count: audienceCounts.staff },
          ]}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SegmentedTabs
          layoutId="reviews-tab"
          value={tab}
          onChange={(v) => setTab(v)}
          tabs={[
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'approved', label: 'Approved', count: counts.approved },
            { value: 'rejected', label: 'Archived', count: counts.rejected },
          ]}
        />
        <div className="ml-auto w-full sm:w-48">
          <Select id="reviews-sort" value={sort} onChange={(v) => setSort(v as SortKey)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="rating">Highest rating</option>
          </Select>
        </div>
      </div>

      <div className="max-w-3xl">
        {loading ? (
          <SkeletonRows count={4} height="h-44" />
        ) : visible.length === 0 ? (
          <div className={glassCard}>
            <EmptyState
              icon={<Star size={22} />}
              hue="magenta"
              title={(audience === 'staff' ? TEAM_TAB_EMPTY : TAB_EMPTY)[tab].title}
              body={(audience === 'staff' ? TEAM_TAB_EMPTY : TAB_EMPTY)[tab].body}
            />
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {visible.map((review) => {
              const s = review.submission;
              // Fail CLOSED: only an explicit `true` is consent. `undefined`
              // (an older record, or a truncated payload) used to read as
              // consented and armed the publish button.
              const consented = s.consent === true;
              const team = audienceOf(review) === 'staff';
              // Two different anonymity switches: families pick a credit
              // option, team members tick a box. Both mean "no name on site".
              const anonymous = team
                ? s.anonymous === true
                : s.credit === 'Post anonymously';
              /** ADMIN-ONLY. Never rendered anywhere the public can reach. */
              const name = realName(review);
              const isOpen = !!expanded[review.id];
              const busy = busyIds.has(review.id);
              /* Invented copy must never be mistaken for a family's words. */
              const imported = review.moderation?.decidedBy === 'import';
              const note = (review.moderation?.note || '').trim();

              return (
                <motion.article
                  key={review.id}
                  layout={!reduced}
                  exit={reduced ? undefined : exitFor(review.status)}
                  className={cn(
                    glassCard,
                    'mb-4 overflow-hidden',
                    ringing === review.id && 'animate-approve-ring',
                  )}
                >
                  {review.status === 'approved' && <GradientFrame className="rounded-[18px]" />}

                  <div className="relative">
                    <div className="flex flex-wrap items-center gap-3">
                      <Stars rating={s.rating || review.display.rating || 0} />
                      <StatusPill kind="review" status={review.status} />
                      {team && (
                        <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', HUES.teal.chip)}>
                          Team review
                        </span>
                      )}
                      {imported && (
                        <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold-bright ring-1 ring-gold/30">
                          Sample copy
                        </span>
                      )}
                      <span className="ml-auto text-xs text-text-light/65" title={fullDate(review.createdAt)}>
                        {relativeTime(review.createdAt)}
                      </span>
                    </div>

                    {note && (
                      <p className="mt-3 flex items-start gap-2 rounded-xl bg-gold/10 px-3 py-2 text-xs leading-relaxed text-gold-bright ring-1 ring-gold/20">
                        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{note}</span>
                      </p>
                    )}

                    {s.headline && (
                      <h3 className="mt-3 text-lg font-semibold text-text-light">{s.headline}</h3>
                    )}

                    <p
                      className={cn(
                        'mt-2 text-[15px] leading-relaxed text-text-light',
                        !isOpen && 'line-clamp-4 sm:line-clamp-3',
                      )}
                    >
                      {s.review || review.display.quote}
                    </p>
                    {/* The paragraph above is what the FAMILY wrote. Once the
                        owner edits the published copy the two diverge, and
                        without this the card looks like the save did nothing. */}
                    {(review.display?.quote || '').trim() !== (s.review || '').trim() &&
                      (review.display?.quote || '').trim() !== '' && (
                        <div className="mt-3 rounded-xl border border-teal-bright/25 bg-teal-bright/[0.07] px-3 py-2.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-teal-bright">
                            Published on the site
                          </span>
                          <p className="mt-1 text-[14px] leading-relaxed text-text-light/90">
                            {review.display.quote}
                          </p>
                        </div>
                      )}

                    {(s.review || '').length > 180 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((e) => ({ ...e, [review.id]: !e[review.id] }))
                        }
                        className="mt-1.5 text-[13px] font-semibold text-teal-bright hover:underline"
                      >
                        {isOpen ? 'Show less' : 'Read more'}
                      </button>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 pt-4">
                      <Medallion
                        label={
                          team
                            ? review.display.initials || 'TM'
                            : anonymous
                              ? '?'
                              : initialsOf(name || review.display.attribution)
                        }
                        gradient={avatarGradient(review.id)}
                        size="sm"
                      />
                      {team ? (
                        /* The REAL full name, so the owner knows who wrote it,
                           with the string the site will actually publish right
                           beside it. The two are never the same. */
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-text-light">
                            {name || '—'}
                            <span className="ml-2 font-normal text-text-light/60">
                              → published as “{review.display.attribution || '—'}”
                            </span>
                          </span>
                          <span className="block text-xs text-text-light/65">
                            {[s.relationship, s.role, s.tenure].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </span>
                      ) : (
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-text-light">
                            {anonymous ? (
                              <>
                                Anonymous{' '}
                                <span className="font-normal text-text-light/60">
                                  (name hidden on site: {name || '—'})
                                </span>
                              </>
                            ) : (
                              name || review.display.attribution
                            )}
                          </span>
                          <span className="block text-xs text-text-light/65">
                            Credit as: {s.credit || '—'}
                            {s.location ? ` · ${s.location}` : ''}
                          </span>
                        </span>
                      )}
                      {team && anonymous && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-text-light ring-1 ring-white/20">
                          <EyeOff size={13} aria-hidden="true" />
                          Publishing anonymously
                        </span>
                      )}
                      {!team && s.service && (
                        <span
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-semibold',
                            HUES.teal.chip,
                          )}
                        >
                          {s.service}
                        </span>
                      )}
                      <ConsentBadge consent={consented} />
                    </div>
                    {team && (
                      <p className="mt-2 text-xs leading-relaxed text-text-light/55">
                        Only “{review.display.attribution}” is ever published — the surname stays
                        in this dashboard.
                      </p>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                      {review.status === 'pending' && (
                        <>
                          {/* The wrapper catches taps on the disabled button —
                              disabled controls swallow their own clicks, so the
                              button drops pointer events and the span explains. */}
                          <span
                            className={cn(
                              'flex-1 sm:flex-none',
                              !consented && 'cursor-not-allowed',
                            )}
                            onClick={() => {
                              if (!consented) {
                                push({
                                  tone: 'info',
                                  title: 'Private feedback can’t be published',
                                  body: 'This reviewer asked for their words to stay private.',
                                });
                              }
                            }}
                          >
                            <button
                              type="button"
                              disabled={!consented || busy}
                              onClick={() =>
                                setStatus(review, 'approved', {
                                  ring: true,
                                  liveHash: team ? '/#careers' : '/#voices',
                                  toast: {
                                    title: 'Published to the site',
                                    body: team
                                      ? 'It now appears in “What our team says” on the careers section.'
                                      : 'It now appears in the homepage carousel.',
                                  },
                                  activity: `Published a ${team ? 'team ' : ''}review from ${
                                    anonymous ? (team ? 'an anonymous team member' : 'an anonymous family') : name || (team ? 'a team member' : 'a family')
                                  }`,
                                })
                              }
                              className={cn(
                                btnGold,
                                'w-full sm:w-auto',
                                !consented && 'pointer-events-none',
                              )}
                            >
                              {busy ? <Working label="Publishing…" /> : 'Approve & publish'}
                            </button>
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              confirm({
                                title: 'Archive this review?',
                                body: (
                                  <>
                                    The review from{' '}
                                    <strong className="text-text-light">
                                      {anonymous ? (team ? 'an anonymous team member' : 'an anonymous family') : name || (team ? 'a team member' : 'a family')}
                                    </strong>{' '}
                                    will be hidden from this list. Nothing is deleted and you can
                                    restore it later.
                                  </>
                                ),
                                confirmLabel: 'Archive review',
                                onConfirm: () =>
                                  setStatus(review, 'rejected', {
                                    toast: { title: 'Review archived' },
                                    activity: `Archived a ${team ? 'team ' : ''}review from ${name || (team ? 'a team member' : 'a family')}`,
                                  }),
                              })
                            }
                            className={cn(btnGhost, 'w-full sm:w-auto')}
                          >
                            Reject
                          </button>
                          <EditButton onClick={() => openEdit(review)} />
                        </>
                      )}


                      {review.status === 'approved' && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              confirm({
                                title: 'Unpublish this review?',
                                body: (
                                  <>
                                    It will be removed from the{' '}
                                    {team ? 'careers section' : 'homepage carousel'} immediately
                                    and moved back to Pending.
                                  </>
                                ),
                                confirmLabel: 'Unpublish',
                                onConfirm: () =>
                                  setStatus(review, 'pending', {
                                    toast: { title: 'Removed from the site' },
                                    activity: `Unpublished a ${team ? 'team ' : ''}review from ${name || (team ? 'a team member' : 'a family')}`,
                                  }),
                              })
                            }
                            className={cn(btnGhost, 'w-full sm:w-auto')}
                          >
                            {busy ? <Working label="Working…" /> : 'Unpublish'}
                          </button>
                          <EditButton onClick={() => openEdit(review)} />
                          {/* Deleting a LIVE review is offered here too — an
                              imported sample the owner never wants shown should
                              not need an unpublish-then-archive detour first.
                              The confirm copy says it vanishes from the site. */}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => confirmDelete(review, true)}
                            className={cn(btnDanger, 'w-full sm:w-auto')}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                          <span className="inline-flex items-center gap-2 text-xs text-text-light/60 sm:ml-2">
                            <span className="relative flex h-2 w-2" aria-hidden="true">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-bright opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-bright" />
                            </span>
                            Live on site
                          </span>
                        </>
                      )}

                      {review.status === 'rejected' && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setStatus(review, 'pending', {
                                toast: { title: 'Restored to pending' },
                                activity: `Restored a ${team ? 'team ' : ''}review from ${name || (team ? 'a team member' : 'a family')}`,
                              })
                            }
                            className={cn(btnGhost, 'w-full sm:w-auto')}
                          >
                            <Undo2 size={16} />
                            Restore to pending
                          </button>
                          <EditButton onClick={() => openEdit(review)} />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => confirmDelete(review, false)}
                            className={cn(btnDanger, 'w-full sm:w-auto')}
                          >
                            <Trash2 size={16} />
                            Delete forever
                          </button>
                        </>
                      )}
                    </div>

                    {review.status === 'pending' && !consented && (
                      <p className="mt-2.5 text-xs leading-relaxed text-text-light/60">
                        This reviewer asked for private feedback — it can&rsquo;t be published. You
                        can still mark it reviewed or archive it.
                      </p>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <Drawer
        open={!!draft}
        onClose={() => setDraft(null)}
        title="Edit published text"
        width={460}
        blooms={PANEL_BLOOMS.gold}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setDraft(null)} className={btnGhost}>
              Cancel
            </button>
            <button
              type="button"
              onClick={saveDraft}
              disabled={savingDraft}
              className={cn(btnGold, 'min-w-[9rem]')}
            >
              {savingDraft ? <Working label="Saving…" /> : 'Save changes'}
            </button>
          </div>
        }
      >
        {draft && (
          <div className="space-y-5">
            <p className="text-xs leading-relaxed text-text-light/65">
              {draft.audience === 'staff'
                ? 'This is the copy that appears in the careers section. The team member’s original submission is kept untouched underneath.'
                : 'This is the copy that appears on the homepage. The family’s original submission is kept untouched underneath.'}
            </p>

            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-text-light">
                {draft.audience === 'staff' ? 'In the careers section' : 'On the homepage'}
              </span>
              {draft.audience === 'staff' ? (
                <CareersPreview draft={draft} seed={draft.id} />
              ) : (
                <HomepagePreview draft={draft} seed={draft.id} />
              )}
            </div>

            <div>
              <Label htmlFor="rv-quote" required>
                Quote
              </Label>
              <textarea
                id="rv-quote"
                rows={6}
                value={draft.quote}
                onChange={(e) => setDraft((d) => (d ? { ...d, quote: e.target.value } : d))}
                className={cn(fieldBase, 'resize-y')}
              />
            </div>

            {draft.audience === 'staff' ? (
              <>
                <div>
                  <Label htmlFor="rv-attribution">Published as</Label>
                  <input
                    id="rv-attribution"
                    value={draft.attribution}
                    readOnly
                    aria-readonly="true"
                    className={cn(fieldBase, 'cursor-not-allowed opacity-70')}
                  />
                  <p className="mt-1.5 text-xs leading-relaxed text-text-light/55">
                    Derived on the server from the full name and the anonymity choice. It
                    can&rsquo;t be edited here — that is what keeps the surname off the site.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rv-role">Role</Label>
                    <input
                      id="rv-role"
                      value={draft.role}
                      onChange={(e) => setDraft((d) => (d ? { ...d, role: e.target.value } : d))}
                      placeholder="Lead RBT"
                      className={fieldBase}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rv-tenure">Time at CAL-ABA</Label>
                    <input
                      id="rv-tenure"
                      value={draft.tenure}
                      onChange={(e) => setDraft((d) => (d ? { ...d, tenure: e.target.value } : d))}
                      placeholder="2 years"
                      className={fieldBase}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rv-relationship">Current / former</Label>
                    <Select
                      id="rv-relationship"
                      value={draft.relationship || 'Current team member'}
                      onChange={(v) => setDraft((d) => (d ? { ...d, relationship: v } : d))}
                    >
                      <option>Current team member</option>
                      <option>Former team member</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rv-rating">Rating</Label>
                    <Select
                      id="rv-rating"
                      value={String(draft.rating)}
                      onChange={(v) => setDraft((d) => (d ? { ...d, rating: Number(v) } : d))}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} star{n === 1 ? '' : 's'}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="rv-attribution" required>
                    Attribution
                  </Label>
                  <input
                    id="rv-attribution"
                    value={draft.attribution}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, attribution: e.target.value } : d))
                    }
                    placeholder="Parent of a 4-year-old"
                    className={fieldBase}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rv-location">Location</Label>
                    <input
                      id="rv-location"
                      value={draft.location}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, location: e.target.value } : d))
                      }
                      placeholder="Broward County"
                      className={fieldBase}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rv-service">Service</Label>
                    <input
                      id="rv-service"
                      value={draft.service}
                      onChange={(e) => setDraft((d) => (d ? { ...d, service: e.target.value } : d))}
                      placeholder="Home-Based ABA"
                      className={fieldBase}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rv-initials" required>
                      Initials
                    </Label>
                    <input
                      id="rv-initials"
                      value={draft.initials}
                      maxLength={MAX_INITIALS}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, initials: e.target.value.slice(0, MAX_INITIALS) } : d,
                        )
                      }
                      placeholder="BC"
                      className={fieldBase}
                    />
                    <p className="mt-1.5 text-xs text-text-light/55">
                      Up to {MAX_INITIALS} characters — shown in the avatar circle.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="rv-rating">Rating</Label>
                    <Select
                      id="rv-rating"
                      value={String(draft.rating)}
                      onChange={(v) => setDraft((d) => (d ? { ...d, rating: Number(v) } : d))}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} star{n === 1 ? '' : 's'}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>

      {dialog}
    </PageEnter>
  );
}

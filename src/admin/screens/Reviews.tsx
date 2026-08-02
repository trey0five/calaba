import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, Trash2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { easeOutExpo, usePrefersReducedMotion } from '@/lib/motion';
import { Select } from '@/lib/ui';
import * as api from '../adminApi';
import { useAuth } from '../auth';
import { useAdminData } from '../data';
import { useAdminRoute } from '../router';
import type { AdminReview, ReviewStatus } from '../types';
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

  useEffect(() => {
    const q = route.query.status as ReviewStatus | undefined;
    if (q && q !== tab && ['pending', 'approved', 'rejected'].includes(q)) setTab(q);
    // Only react to an incoming deep link, never to local tab clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.query.status]);

  const counts = useMemo(
    () => ({
      pending: reviews.filter((r) => r.status === 'pending').length,
      approved: reviews.filter((r) => r.status === 'approved').length,
      rejected: reviews.filter((r) => r.status === 'rejected').length,
    }),
    [reviews],
  );

  const visible = useMemo(() => {
    const list = reviews.filter((r) => r.status === tab || pinned[r.id] === tab);
    const byDate = (a: AdminReview, b: AdminReview) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === 'oldest') return [...list].sort((a, b) => byDate(b, a));
    if (sort === 'rating')
      return [...list].sort(
        (a, b) => (b.submission.rating || 0) - (a.submission.rating || 0) || byDate(a, b),
      );
    return [...list].sort(byDate);
  }, [reviews, tab, pinned, sort]);

  const patchStatus = (id: string, status: ReviewStatus) =>
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

  /** Optimistic status change with undo, ring flourish and rollback on failure. */
  const setStatus = async (
    review: AdminReview,
    next: ReviewStatus,
    opts: { ring?: boolean; toast: { title: string; body?: string }; activity: string },
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
            ? { label: 'View on the site', url: '/#voices' }
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

  const removeForever = async (review: AdminReview) => {
    const snapshot = reviews;
    setReviews((prev) => prev.filter((r) => r.id !== review.id));
    try {
      await authed((t) => api.deleteReview(t, review.id));
      logActivity(`Deleted a review from ${review.submission.name || 'a family'}`, 'coral');
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
          <>
            Family <span className="brand-gradient-text-bright">reviews</span>
          </>
        }
        sub="Nothing appears on the site until you approve it."
      />

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
              title={TAB_EMPTY[tab].title}
              body={TAB_EMPTY[tab].body}
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
              const anonymous = s.credit === 'Post anonymously';
              const isOpen = !!expanded[review.id];
              const busy = busyIds.has(review.id);

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
                      <span className="ml-auto text-xs text-text-light/65" title={fullDate(review.createdAt)}>
                        {relativeTime(review.createdAt)}
                      </span>
                    </div>

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
                        label={anonymous ? '?' : initialsOf(s.name || review.display.attribution)}
                        gradient={avatarGradient(review.id)}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-text-light">
                          {anonymous ? (
                            <>
                              Anonymous{' '}
                              <span className="font-normal text-text-light/60">
                                (name hidden on site: {s.name || '—'})
                              </span>
                            </>
                          ) : (
                            s.name || review.display.attribution
                          )}
                        </span>
                        <span className="block text-xs text-text-light/65">
                          Credit as: {s.credit || '—'}
                          {s.location ? ` · ${s.location}` : ''}
                        </span>
                      </span>
                      {s.service && (
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
                                  toast: {
                                    title: 'Published to the site',
                                    body: 'It now appears in the homepage carousel.',
                                  },
                                  activity: `Published a review from ${
                                    anonymous ? 'an anonymous family' : s.name || 'a family'
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
                                      {anonymous ? 'an anonymous family' : s.name || 'a family'}
                                    </strong>{' '}
                                    will be hidden from this list. Nothing is deleted and you can
                                    restore it later.
                                  </>
                                ),
                                confirmLabel: 'Archive review',
                                onConfirm: () =>
                                  setStatus(review, 'rejected', {
                                    toast: { title: 'Review archived' },
                                    activity: `Archived a review from ${s.name || 'a family'}`,
                                  }),
                              })
                            }
                            className={cn(btnGhost, 'w-full sm:w-auto')}
                          >
                            Reject
                          </button>
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
                                    It will be removed from the homepage carousel immediately and
                                    moved back to Pending.
                                  </>
                                ),
                                confirmLabel: 'Unpublish',
                                onConfirm: () =>
                                  setStatus(review, 'pending', {
                                    toast: { title: 'Removed from the site' },
                                    activity: `Unpublished a review from ${s.name || 'a family'}`,
                                  }),
                              })
                            }
                            className={cn(btnGhost, 'w-full sm:w-auto')}
                          >
                            {busy ? <Working label="Working…" /> : 'Unpublish'}
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
                                activity: `Restored a review from ${s.name || 'a family'}`,
                              })
                            }
                            className={cn(btnGhost, 'w-full sm:w-auto')}
                          >
                            <Undo2 size={16} />
                            Restore to pending
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              confirm({
                                title: 'Delete this review forever?',
                                body: (
                                  <>
                                    The review from{' '}
                                    <strong className="text-text-light">
                                      {s.name || 'a family'}
                                    </strong>{' '}
                                    will be permanently removed. This cannot be undone.
                                  </>
                                ),
                                confirmLabel: 'Delete forever',
                                requireTyped: 'DELETE',
                                onConfirm: () => removeForever(review),
                              })
                            }
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

      {dialog}
    </PageEnter>
  );
}

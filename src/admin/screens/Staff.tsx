import { RefObject, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  GripVertical,
  ImageIcon,
  Pencil,
  Pin,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import PublicStaffCard from '@/components/primitives/StaffCard';
import { easeOutExpo, usePrefersReducedMotion } from '@/lib/motion';
import { fieldBase, Label, PANEL_BLOOMS } from '@/lib/ui';
import * as api from '../adminApi';
import { useAuth } from '../auth';
import { useAdminData } from '../data';
import Drawer from '../components/Drawer';
import UploadDropzone, { ProcessedPhoto } from '../components/UploadDropzone';
import type { StaffMember } from '../types';
import {
  btnDanger,
  btnGhost,
  btnGold,
  EmptyState,
  focusRing,
  glassCard,
  PageEnter,
  PageHeader,
  Skeleton,
  useConfirm,
  useToast,
  Working,
} from '../ui';

const FOUNDER_FRAME = 'linear-gradient(135deg, #2FE0D8 0%, #FF6FB0 45%, #FFC44D 100%)';

/** Transparent expander to a >=44px touch target without changing the drawn size. */
const HIT_AREA =
  "before:absolute before:left-1/2 before:top-1/2 before:h-11 before:min-w-[44px] before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";

type PublishPhase = 'idle' | 'saving' | 'publishing' | 'live';

interface DraftState {
  id: string | null;
  name: string;
  title: string;
  credentials: string;
  isFounder: boolean;
  photo: ProcessedPhoto | null;
}

const EMPTY_DRAFT: DraftState = {
  id: null,
  name: '',
  title: '',
  credentials: '',
  isFounder: false,
  photo: null,
};

function StaffCard({
  member,
  onEdit,
  onReplacePhoto,
  onRemove,
  ringing,
}: {
  member: StaffMember;
  onEdit: () => void;
  onReplacePhoto: () => void;
  onRemove: () => void;
  ringing: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const founder = !!member.isFounder;
  const photo = member.photo?.url;

  const inner = (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl bg-bg-deep',
        founder
          ? 'aspect-[4/5] sm:aspect-[3/2]'
          : 'ring-1 ring-teal/20 shadow-glow-magenta',
      )}
    >
      {founder ? (
        <>
          {photo ? (
            <img
              src={photo}
              alt={`${member.name}, ${member.title}`}
              width={member.photo?.w || 900}
              height={member.photo?.h || 600}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-text-light/40">
              <ImageIcon size={30} />
            </div>
          )}

          {/* Scrim + identity */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 via-ink-950/40 to-transparent p-4 pt-10">
            <p className="truncate text-[15px] font-bold text-text-light">{member.name}</p>
            <p className="truncate text-xs font-semibold text-gold-bright">{member.title}</p>
          </div>
        </>
      ) : (
        /* The real homepage card, composed from the headshot — so this grid is
           literally "what families see" rather than a bare photo thumbnail. */
        <PublicStaffCard photoUrl={photo || ''} name={member.name} title={member.title} />
      )}

      {founder && (
        <span className="absolute left-3 top-3 rounded-full bg-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink">
          Founder
        </span>
      )}

      {/* Action bar — always visible on touch, revealed on hover/focus on desktop */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-end gap-2 p-3 transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
        {/* 32px targets with 11px type are below the 44px / 13px floor on a
            phone, where this bar is permanently visible. The buttons keep their
            drawn size and grow a transparent `before:` expander instead. */}
        <button
          type="button"
          onClick={onReplacePhoto}
          className={cn(
            'relative rounded-full bg-ink-950/75 px-3 py-2 text-[13px] font-semibold text-text-light ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15',
            HIT_AREA,
            focusRing,
          )}
        >
          Replace photo
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${member.name}`}
          className={cn(
            'relative grid h-9 w-9 place-items-center rounded-full bg-ink-950/75 text-text-light ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15',
            HIT_AREA,
            focusRing,
          )}
        >
          <Pencil size={16} />
        </button>
        {!founder && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${member.name}`}
            className={cn(
              'relative grid h-9 w-9 place-items-center rounded-full bg-ink-950/75 text-coral-bright ring-1 ring-coral-bright/40 backdrop-blur transition hover:bg-coral-bright/15',
              HIT_AREA,
              focusRing,
            )}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      layout={!reduced}
      className={cn('group relative', ringing && 'animate-approve-ring rounded-3xl')}
    >
      {founder ? (
        <div className="rounded-[26px] p-[2px]" style={{ background: FOUNDER_FRAME }}>
          {inner}
        </div>
      ) : (
        inner
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Reordering
 *
 * Framer Motion's <Reorder> only ever compares positions along ONE axis, so
 * dragging inside the wrapping 2/3-column card grid would compare a card in
 * row 2 against a card in row 1 and swap the wrong people. Reordering
 * therefore happens in a dedicated single-column mode, which also keeps drag
 * from ever fighting the hover action bar (Replace photo / Edit / Remove) on
 * the cards.
 * ------------------------------------------------------------------ */

/** Rapid clicks on the arrows coalesce into ONE batch of PUTs. */
const ORDER_FLUSH_MS = 500;

const rowShell =
  'flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10';

function RowThumb({ member }: { member: StaffMember }) {
  return (
    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-bg-deep ring-1 ring-white/10">
      {member.photo?.url ? (
        <img src={member.photo.url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center text-text-light/40">
          <ImageIcon size={16} />
        </span>
      )}
    </span>
  );
}

function TeamOrderRow({
  member,
  index,
  total,
  draggable,
  reduced,
  constraints,
  onMove,
  onDragStarted,
  onDragSettled,
}: {
  member: StaffMember;
  index: number;
  total: number;
  draggable: boolean;
  reduced: boolean;
  constraints: RefObject<HTMLElement>;
  onMove: (dir: -1 | 1) => void;
  onDragStarted: () => void;
  onDragSettled: () => void;
}) {
  const controls = useDragControls();
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);

  const move = (dir: -1 | 1) => {
    onMove(dir);
    // The row keeps its DOM node through the reorder, so focus survives — but a
    // button that has just become disabled is blurred by the browser. Hand
    // focus to the opposite arrow so a keyboard user never lands on <body>.
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        const pressed = dir === -1 ? upRef.current : downRef.current;
        if (pressed?.disabled) (dir === -1 ? downRef : upRef).current?.focus();
      });
    }
  };

  const arrow =
    'relative grid h-9 w-9 place-items-center rounded-full bg-ink-950/70 text-text-light ring-1 ring-white/20 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-ink-950/70';

  return (
    <Reorder.Item
      value={member.id}
      drag={draggable ? 'y' : false}
      dragListener={false}
      dragControls={controls}
      dragConstraints={constraints}
      dragElastic={0.06}
      onDragStart={onDragStarted}
      onDragEnd={onDragSettled}
      transition={reduced ? { duration: 0 } : { duration: 0.3, ease: easeOutExpo }}
      className={cn(rowShell, 'list-none')}
    >
      {/* Pointer affordance only, and only where there is room for it: on a
          phone the row needs that 44px for the name, and the arrows are the
          touch path anyway. */}
      {draggable ? (
        <span
          onPointerDown={(e) => controls.start(e)}
          className="hidden h-11 w-11 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-text-light/45 transition hover:text-text-light/80 active:cursor-grabbing sm:grid"
          aria-hidden="true"
        >
          <GripVertical size={18} />
        </span>
      ) : (
        <span className="hidden h-11 w-11 shrink-0 sm:block" aria-hidden="true" />
      )}

      <RowThumb member={member} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-text-light">{member.name}</span>
        <span className="block truncate text-xs text-text-light/65">
          {member.title || 'No title yet'}
        </span>
      </span>

      <span
        className="hidden shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-text-light/70 sm:inline-block"
        aria-hidden="true"
      >
        {index + 1} / {total}
      </span>

      <span className="flex shrink-0 items-center gap-2">
        <button
          ref={upRef}
          type="button"
          disabled={index === 0}
          onClick={() => move(-1)}
          aria-label={`Move ${member.name} up`}
          className={cn(arrow, HIT_AREA, focusRing)}
        >
          <ArrowUp size={16} />
        </button>
        <button
          ref={downRef}
          type="button"
          disabled={index === total - 1}
          onClick={() => move(1)}
          aria-label={`Move ${member.name} down`}
          className={cn(arrow, HIT_AREA, focusRing)}
        >
          <ArrowDown size={16} />
        </button>
      </span>
    </Reorder.Item>
  );
}

export default function Staff() {
  const { authed } = useAuth();
  const { staff, loading, setStaff, logActivity } = useAdminData();
  const { push } = useToast();
  const { confirm, dialog } = useConfirm();
  const reduced = usePrefersReducedMotion();

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [phase, setPhase] = useState<PublishPhase>('idle');
  const [ringing, setRinging] = useState<string | null>(null);
  const [focusPhoto, setFocusPhoto] = useState(false);
  const savingRef = useRef(false);

  const [reordering, setReordering] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const ordered = [...staff].sort(
    (a, b) => Number(!!b.isFounder) - Number(!!a.isFounder) || (a.order ?? 0) - (b.order ?? 0),
  );
  /* The founder is pinned by `isFounder`, not by `order`, so they are held out
     of the reorderable set entirely rather than just sorted to the front. */
  const pinned = ordered.filter((s) => s.isFounder);
  const members = ordered.filter((s) => !s.isFounder);

  /* --------------------------- order plumbing --------------------------- */

  /** Latest committed staff, readable from the debounce timer. */
  const staffRef = useRef(staff);
  useEffect(() => {
    staffRef.current = staff;
  }, [staff]);
  /** Last server-confirmed list — the rollback target for a whole burst. */
  const baselineRef = useRef<StaffMember[] | null>(null);
  const flushTimer = useRef<number | null>(null);
  /** A drag fires onReorder once per row it crosses; hold the write until it
   *  is let go so one gesture is one batch. */
  const draggingRef = useRef(false);
  const flushingRef = useRef(false);

  const flushOrder = async () => {
    flushTimer.current = null;
    // Never overlap two batches: the second would take the first's optimistic
    // state as its rollback target, and a failure would strand the difference.
    if (flushingRef.current) {
      scheduleFlush();
      return;
    }
    const baseline = baselineRef.current;
    baselineRef.current = null;
    if (!baseline) return;
    const changed = staffRef.current.filter(
      (s) => !s.isFounder && (baseline.find((b) => b.id === s.id)?.order ?? 0) !== s.order,
    );
    if (!changed.length) return;
    flushingRef.current = true;
    setSavingOrder(true);
    const written: StaffMember[] = [];
    try {
      // Sequential on purpose: every PUT is a read-modify-write of the same
      // staff.json object behind an ETag, and firing them in parallel just
      // burns the server's three retries against itself.
      for (const m of changed) {
        await authed((t) => api.updateStaff(t, m.id, { order: m.order }));
        written.push(m);
      }
      // Also clears the cached public payload, so the homepage picks the new
      // running order up on the next paint rather than after the TTL.
      logActivity('Reordered the team', 'teal');
    } catch (err) {
      setStaff(() => baseline);
      // A batch that died halfway leaves the server holding part of the new
      // order while the screen shows the old one. Put back what already
      // landed, so "the previous order was restored" is true of the site too.
      let undone = true;
      for (const m of written) {
        const was = baseline.find((b) => b.id === m.id)?.order ?? 0;
        try {
          await authed((t) => api.updateStaff(t, m.id, { order: was }));
        } catch {
          undone = false;
        }
      }
      const tail = undone
        ? 'The previous order was restored.'
        : 'Refresh the page to see the order the site is actually using.';
      setOrderNote(tail);
      push({
        tone: 'error',
        title: 'Couldn’t save the new order',
        body: err instanceof api.ApiError ? `${err.message} ${tail}` : `Check your connection and try again — ${tail.charAt(0).toLowerCase()}${tail.slice(1)}`,
      });
    } finally {
      flushingRef.current = false;
      setSavingOrder(false);
    }
  };

  // The unmount/leave flush must not be re-created on every render, or its
  // cleanup would fire a write each time `authed` changed identity.
  const flushRef = useRef(flushOrder);
  useEffect(() => {
    flushRef.current = flushOrder;
  });
  useEffect(
    () => () => {
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
      if (baselineRef.current) void flushRef.current();
    },
    [],
  );

  const scheduleFlush = () => {
    if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(() => void flushOrder(), ORDER_FLUSH_MS);
  };

  /** Write immediately — leaving reorder mode, or unmounting. */
  const flushNow = () => {
    if (flushTimer.current !== null) {
      window.clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    if (baselineRef.current) void flushOrder();
  };

  /** Adopt a new running order optimistically, renumbered densely from 0. */
  const applyOrder = (ids: string[]) => {
    // A drawer owns the screen while it is open; nothing behind it may move.
    if (draft) return;
    if (!baselineRef.current) baselineRef.current = staffRef.current;
    const rank = new Map(ids.map((id, i) => [id, i] as const));
    setStaff((prev) =>
      prev.map((s) => {
        const next = rank.get(s.id);
        return next === undefined || s.isFounder || s.order === next ? s : { ...s, order: next };
      }),
    );
    if (!draggingRef.current) scheduleFlush();
  };

  const moveMember = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= members.length) return;
    const next = [...members];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    applyOrder(next.map((m) => m.id));
    setOrderNote(`Moved ${moved.name} to position ${to + 1} of ${next.length}`);
  };

  /* Reset the publish state machine whenever the drawer OPENS (or switches to a
     different member). `draft` is a fresh object on every render, so depending
     on it re-ran this on every keystroke and stomped `saving`/`publishing`. */
  useEffect(() => {
    if (draft) setPhase('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, !!draft]);

  const openEdit = (member: StaffMember, photoFirst = false) => {
    setFocusPhoto(photoFirst);
    setDraft({
      id: member.id,
      name: member.name,
      title: member.title,
      credentials: (member.credentials || []).join(', '),
      isFounder: !!member.isFounder,
      photo: null,
    });
  };

  const save = async () => {
    if (!draft) return;
    // A double tap (or a stale `phase` after a re-render) must never issue two
    // creates — the second one would add a duplicate team member.
    if (savingRef.current) return;
    if (!draft.name.trim()) {
      push({ tone: 'error', title: 'A name is required' });
      return;
    }
    savingRef.current = true;
    setPhase('saving');
    const payload = {
      name: draft.name.trim(),
      title: draft.title.trim(),
      credentials: draft.credentials
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    };

    try {
      let record: StaffMember;
      if (draft.id) {
        record = await authed((t) => api.updateStaff(t, draft.id as string, payload));
      } else {
        record = await authed((t) => api.createStaff(t, payload));
      }

      // The member record now exists server-side. Adopt it into state and into
      // the draft IMMEDIATELY, before the photo is attempted — otherwise a
      // failed upload left an orphaned record the UI knew nothing about, and a
      // second Save created a duplicate.
      const mergeRecord = (r: StaffMember) =>
        setStaff((prev) => {
          const exists = prev.some((s) => s.id === r.id);
          return exists ? prev.map((s) => (s.id === r.id ? r : s)) : [...prev, r];
        });
      mergeRecord(record);
      const created = !draft.id;
      if (created) setDraft((d) => (d ? { ...d, id: record.id } : d));

      if (draft.photo) {
        setPhase('publishing');
        try {
          record = await authed((t) =>
            api.uploadStaffPhoto(t, record.id, {
              data: draft.photo!.data,
              contentType: draft.photo!.contentType,
              w: draft.photo!.w,
              h: draft.photo!.h,
            }),
          );
        } catch (photoErr) {
          savingRef.current = false;
          setPhase('idle');
          push({
            tone: 'error',
            title: created
              ? `${record.name} was saved, but the photo didn’t upload`
              : 'Saved, but the photo didn’t upload',
            body:
              (photoErr instanceof api.ApiError ? `${photoErr.message} ` : '') +
              'Use Replace photo to try the picture again — the rest is already live.',
          });
          return;
        }
      } else {
        setPhase('publishing');
      }

      mergeRecord(record);
      logActivity(
        draft.id ? `Updated ${record.name}’s team card` : `Added ${record.name} to the team`,
        'teal',
      );
      savingRef.current = false;
      setPhase('live');
      setRinging(record.id);
      window.setTimeout(() => setRinging((id) => (id === record.id ? null : id)), 800);
      window.setTimeout(() => {
        setDraft(null);
        setPhase('idle');
      }, 900);
    } catch (err) {
      savingRef.current = false;
      setPhase('idle');
      push({
        tone: 'error',
        title: 'Couldn’t save that',
        body:
          err instanceof api.ApiError
            ? err.message
            : 'Check your connection and try again — nothing was published.',
      });
    }
  };

  const remove = async (member: StaffMember) => {
    const snapshot = staff;
    setStaff((prev) => prev.filter((s) => s.id !== member.id));
    try {
      await authed((t) => api.deleteStaff(t, member.id));
      logActivity(`Removed ${member.name} from the team`, 'coral');
      push({
        tone: 'info',
        title: `${member.name} removed`,
        body: 'The team section on the site has been updated.',
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const restored = await authed((t) =>
                api.createStaff(t, {
                  name: member.name,
                  title: member.title,
                  credentials: member.credentials,
                }),
              );
              setStaff((prev) => [...prev, restored]);
              push({
                tone: 'info',
                title: `${member.name} restored`,
                body: 'Their photo needs to be uploaded again.',
              });
            } catch {
              push({ tone: 'error', title: 'Couldn’t restore that team member' });
            }
          },
        },
      });
    } catch (err) {
      setStaff(() => snapshot);
      push({
        tone: 'error',
        title: 'Couldn’t remove that team member',
        body: err instanceof api.ApiError ? err.message : 'Nothing was changed.',
      });
    }
  };

  /** What the drawer's dropzone thumbnail and live preview should show: the
   *  headshot just picked, else the one already published. */
  const previewPhoto = draft
    ? draft.photo?.preview ?? staff.find((s) => s.id === draft.id)?.photo?.url ?? null
    : null;

  const phaseLabel: Record<PublishPhase, string> = {
    idle: 'Save & publish',
    saving: 'Saving…',
    publishing: 'Publishing to site…',
    live: 'Live ✓',
  };

  return (
    <PageEnter>
      <PageHeader
        eyebrow="Your people"
        hue="teal"
        title={
          <>
            The <span className="brand-gradient-text-bright">team</span>
          </>
        }
        sub={
          reordering
            ? 'Top to bottom here is left to right on the homepage.'
            : 'These cards are what families see on the homepage.'
        }
        actions={
          reordering ? (
            <button
              type="button"
              onClick={() => {
                setReordering(false);
                flushNow();
              }}
              aria-pressed
              className={btnGold}
            >
              <Check size={17} />
              Done
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => setReordering(true)}
                  aria-pressed={false}
                  className={btnGhost}
                >
                  <ArrowUpDown size={17} />
                  Reorder
                </button>
              )}
              <button type="button" onClick={() => setDraft({ ...EMPTY_DRAFT })} className={btnGold}>
                <Plus size={17} />
                Add team member
              </button>
            </div>
          )
        }
      />

      {/* Persistent live region — a region that appears at the same moment its
          text does is usually skipped by screen readers. */}
      <p className="sr-only" role="status" aria-live="polite">
        {orderNote}
      </p>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[9/11]" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <div className={glassCard}>
          <EmptyState
            icon={<Users size={22} />}
            hue="teal"
            title="No team members yet"
            body="Add the people families will meet. Upload a headshot and type a name and title — the card frame is added for you."
            action={
              <button type="button" onClick={() => setDraft({ ...EMPTY_DRAFT })} className={btnGold}>
                <Plus size={17} />
                Add team member
              </button>
            }
          />
        </div>
      ) : reordering ? (
        <div className={cn(glassCard, 'space-y-4')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-md text-sm text-text-light/75">
              Use the arrows to move someone up or down — they work on a phone and with a
              keyboard. On a computer you can also drag a row by its handle. Changes save on their
              own.
            </p>
            <span
              className="inline-flex min-h-[1.5rem] items-center gap-2 text-xs font-semibold text-teal-bright"
              aria-hidden="true"
            >
              {savingOrder && <Working label="Saving order…" />}
            </span>
          </div>

          {pinned.map((member) => (
            <div key={member.id} className={cn(rowShell, 'opacity-90')}>
              <span
                className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl text-gold-bright sm:grid"
                aria-hidden="true"
              >
                <Pin size={17} />
              </span>
              <RowThumb member={member} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text-light">
                  {member.name}
                </span>
                <span className="block truncate text-xs text-text-light/65">{member.title}</span>
              </span>
              <span className="shrink-0 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-gold-bright ring-1 ring-gold/30">
                Always first
              </span>
            </div>
          ))}

          <Reorder.Group
            ref={listRef}
            as="ul"
            axis="y"
            values={members.map((m) => m.id)}
            onReorder={applyOrder}
            className="m-0 list-none space-y-3 p-0"
          >
            {members.map((member, i) => (
              <TeamOrderRow
                key={member.id}
                member={member}
                index={i}
                total={members.length}
                /* No drag springs under reduced motion, and nothing moves while
                   an edit drawer owns the screen. The arrows remain the
                   guaranteed path either way. */
                draggable={!reduced && !draft}
                reduced={reduced}
                constraints={listRef}
                onMove={(dir) => moveMember(i, dir)}
                onDragStarted={() => {
                  draggingRef.current = true;
                }}
                onDragSettled={() => {
                  draggingRef.current = false;
                  setOrderNote(`Moved ${member.name} to position ${i + 1} of ${members.length}`);
                  if (baselineRef.current) scheduleFlush();
                }}
              />
            ))}
          </Reorder.Group>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {ordered.map((member) => (
            <StaffCard
              key={member.id}
              member={member}
              ringing={ringing === member.id}
              onEdit={() => openEdit(member)}
              onReplacePhoto={() => openEdit(member, true)}
              onRemove={() =>
                confirm({
                  title: 'Remove this team member?',
                  body: (
                    <>
                      <strong className="text-text-light">{member.name}</strong> will disappear from
                      the team section on calabatherapy.com, and their photo will be erased from
                      storage — every saved version of it, not just the current one.
                    </>
                  ),
                  confirmLabel: 'Remove from site',
                  onConfirm: () => remove(member),
                })
              }
            />
          ))}
        </div>
      )}

      <Drawer
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? `Edit ${draft.name || 'team member'}` : 'Add team member'}
        width={420}
        blooms={PANEL_BLOOMS.teal}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setDraft(null)} className={btnGhost}>
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={phase !== 'idle'}
              className={cn(btnGold, 'min-w-[11rem]')}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={phase}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={reduced ? undefined : { opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: easeOutExpo }}
                  className="inline-flex items-center gap-2"
                >
                  {phase === 'saving' || phase === 'publishing' ? (
                    <Working label={phaseLabel[phase]} />
                  ) : phase === 'live' ? (
                    <>
                      <Check size={17} strokeWidth={3} />
                      Live
                    </>
                  ) : (
                    phaseLabel.idle
                  )}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        }
      >
        {draft && (
          <div className="space-y-5">
            <UploadDropzone
              currentPhoto={previewPhoto}
              busy={phase === 'publishing' && !!draft.photo}
              done={!!draft.photo}
              onPicked={(photo) => {
                setDraft((d) => (d ? { ...d, photo } : d));
                setFocusPhoto(false);
              }}
              onError={(message) => push({ tone: 'error', title: message })}
            />
            {focusPhoto && (
              <p className="text-xs text-teal-bright">
                Choose a new photo above — it replaces the one on the site when you publish.
              </p>
            )}

            <div>
              <Label htmlFor="staff-name" required>
                Name
              </Label>
              <input
                id="staff-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                placeholder="Audrey Tatum"
                className={fieldBase}
              />
            </div>

            <div>
              <Label htmlFor="staff-title">Title</Label>
              <input
                id="staff-title"
                value={draft.title}
                onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                placeholder="Clinical Supervisor"
                className={fieldBase}
              />
            </div>

            {draft.isFounder && (
              <div>
                <Label htmlFor="staff-credentials">Credentials</Label>
                <input
                  id="staff-credentials"
                  value={draft.credentials}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, credentials: e.target.value } : d))
                  }
                  placeholder="Ed.S., BCBA"
                  className={fieldBase}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {draft.credentials
                    .split(',')
                    .map((c) => c.trim())
                    .filter(Boolean)
                    .map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full bg-white/10 px-3 py-1 text-sm text-teal-bright ring-1 ring-teal-bright/35"
                      >
                        {chip}
                      </span>
                    ))}
                </div>
                <p className="mt-2 text-xs text-text-light/65">
                  Bio text is edited in site content.
                </p>
              </div>
            )}

            {/* Live preview — the REAL homepage card, composed from the pending
                headshot plus whatever is currently typed into the fields. */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-bright">
                Live preview
              </p>
              <div className="w-52">
                {draft.isFounder ? (
                  <div className="relative aspect-[3/2] overflow-hidden rounded-3xl bg-bg-deep ring-1 ring-teal/20">
                    {previewPhoto ? (
                      <img
                        src={previewPhoto}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-text-light/40">
                        <ImageIcon size={24} />
                      </span>
                    )}
                  </div>
                ) : (
                  <PublicStaffCard
                    photoUrl={previewPhoto || ''}
                    name={draft.name || 'Name'}
                    title={draft.title || 'Title'}
                    className="ring-1 ring-teal/20"
                  />
                )}
                <p className="mt-3 text-center text-[11px] text-text-light/55">
                  This is exactly how the card appears on the homepage.
                </p>
              </div>
            </div>

            {draft.id && !draft.isFounder && (
              <button
                type="button"
                onClick={() => {
                  const member = staff.find((s) => s.id === draft.id);
                  if (!member) return;
                  confirm({
                    title: 'Remove this team member?',
                    body: (
                      <>
                        <strong className="text-text-light">{member.name}</strong> will disappear
                        from the team section on calabatherapy.com.
                      </>
                    ),
                    confirmLabel: 'Remove from site',
                    onConfirm: async () => {
                      setDraft(null);
                      await remove(member);
                    },
                  });
                }}
                className={cn(btnDanger, 'w-full')}
              >
                <X size={16} />
                Remove from site
              </button>
            )}
          </div>
        )}
      </Drawer>

      {dialog}
    </PageEnter>
  );
}

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ImageIcon, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
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

  const ordered = [...staff].sort(
    (a, b) => Number(!!b.isFounder) - Number(!!a.isFounder) || (a.order ?? 0) - (b.order ?? 0),
  );

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
        sub="These cards are what families see on the homepage."
        actions={
          <button type="button" onClick={() => setDraft({ ...EMPTY_DRAFT })} className={btnGold}>
            <Plus size={17} />
            Add team member
          </button>
        }
      />

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

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, EyeOff, Loader2, Star, X } from 'lucide-react';
import { site } from '@/content/site';
import { fieldBase, Label, PANEL_BLOOMS, PanelChrome } from '@/lib/ui';
import { MIN_FORM_AGE_MS, postReview } from '@/lib/api';
import { useTeamReview } from '@/lib/dialogs';
import { usePrefersReducedMotion, easeOutExpo } from '@/lib/motion';
import { cn } from '@/lib/cn';

/**
 * Staff / former-staff review of working at CAL-ABA.
 *
 * The form always collects the FULL name — the owner needs to know who wrote
 * it — but the published credit is only ever "Anonymous team member" or
 * "Morgan M.". `previewAttribution` below exists purely so the person typing
 * can SEE that before they submit; the authoritative derivation is
 * `team_attribution()` in infra/lambda_function.py and the public endpoint
 * re-derives it on every request. Nothing here is a security control.
 */

type Relationship = 'Current team member' | 'Former team member';

type Values = {
  fullName: string;
  email: string;
  role: string;
  tenure: string;
  headline: string;
  review: string;
};

const EMPTY: Values = {
  fullName: '',
  email: '',
  role: '',
  tenure: '',
  headline: '',
  review: '',
};

const RELATIONSHIPS: Relationship[] = ['Current team member', 'Former team member'];

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

const ANON_ATTRIBUTION = 'Anonymous team member';

/** Mirrors the server's derivation so the hint never promises something else. */
export function previewAttribution(fullName: string, anonymous: boolean) {
  if (anonymous) return ANON_ATTRIBUTION;
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function asPlainText(
  v: Values,
  relationship: Relationship,
  rating: number,
  anonymous: boolean,
  consent: boolean,
) {
  return [
    'New team review submitted on the CAL-ABA website',
    '',
    `Rating: ${rating}/5 (${RATING_WORDS[rating]})`,
    `Full name: ${v.fullName.trim() || '—'}`,
    `Publish as: ${previewAttribution(v.fullName, anonymous) || ANON_ATTRIBUTION}`,
    `Current / former: ${relationship}`,
    `Role: ${v.role.trim() || '—'}`,
    `Time at CAL-ABA: ${v.tenure.trim() || '—'}`,
    `Email: ${v.email.trim() || '—'}`,
    `Headline: ${v.headline.trim() || '—'}`,
    '',
    'Review:',
    v.review.trim() || '—',
    '',
    `Permission to publish: ${consent ? 'YES' : 'NO — private feedback only'}`,
    `Submitted: ${new Date().toLocaleString()}`,
  ].join('\n');
}

export default function TeamReviewDialog() {
  const { open, closeDialog } = useTeamReview();
  const reduced = usePrefersReducedMotion();

  const [values, setValues] = useState<Values>(EMPTY);
  const [relationship, setRelationship] = useState<Relationship>(RELATIONSHIPS[0]);
  const [anonymous, setAnonymous] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [consent, setConsent] = useState(true);
  /* Spam traps: a field no human sees, and the moment the form opened. */
  const [company, setCompany] = useState('');
  const formOpenedAt = useRef(0);
  const [errors, setErrors] = useState<Partial<Record<keyof Values | 'rating', string>>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');

  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const set = (key: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  useEffect(() => {
    if (!open) return;
    formOpenedAt.current = Date.now();
    returnFocusRef.current = document.activeElement;
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    const focusTimer = window.setTimeout(() => firstFieldRef.current?.focus(), 120);

    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      window.clearTimeout(focusTimer);
      (returnFocusRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
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
  }, [open, closeDialog]);

  useEffect(() => {
    if (open || status !== 'done') return;
    const t = window.setTimeout(() => {
      setValues(EMPTY);
      setRelationship(RELATIONSHIPS[0]);
      setAnonymous(false);
      setRating(0);
      setConsent(true);
      setCompany('');
      setStatus('idle');
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, status]);

  const validate = () => {
    const next: Partial<Record<keyof Values | 'rating', string>> = {};
    if (!rating) next.rating = 'Please choose a star rating.';
    if (!values.fullName.trim()) next.fullName = 'Please tell us your full name.';
    if (!values.email.trim()) next.email = 'We need an email to verify your review.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      next.email = 'That email address looks incomplete.';
    if (!values.review.trim()) next.review = 'Please write a few words about working here.';
    else if (values.review.trim().length < 20) next.review = 'Just a little more detail, please.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    if (!validate()) {
      window.setTimeout(() => {
        const bad = panelRef.current?.querySelector<HTMLElement>(
          '[aria-invalid="true"], .border-coral-bright',
        );
        bad?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        bad?.focus?.();
      }, 0);
      return;
    }
    setStatus('sending');

    const subject = `New ${rating}-star team review — ${
      previewAttribution(values.fullName, anonymous) || ANON_ATTRIBUTION
    }`;
    const mailFallback = () => {
      window.location.href = `mailto:${site.contact.email}?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(
        asPlainText(values, relationship, rating, anonymous, consent),
      )}`;
    };

    try {
      /* A silent spam drop still answers 200 {ok:true,id:null} — the sender
         must never learn which submissions were dropped, so we treat it
         exactly like a success. */
      await postReview({
        audience: 'staff',
        rating,
        headline: values.headline.trim(),
        review: values.review.trim(),
        fullName: values.fullName.trim(),
        anonymous,
        role: values.role.trim(),
        tenure: values.tenure.trim(),
        email: values.email.trim(),
        relationship,
        consent,
        company,
        formOpenedAt: formOpenedAt.current || Date.now() - MIN_FORM_AGE_MS,
      });
    } catch {
      // API unreachable / rate-limited — hand off to the mail client so the
      // review still reaches the inbox.
      mailFallback();
    }

    setStatus('done');
  };

  const shown = hoverRating || rating;
  const typedAttribution = previewAttribution(values.fullName, false);
  const published = anonymous ? ANON_ATTRIBUTION : typedAttribution;

  const panelMotion = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 28, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 16, scale: 0.98 },
        transition: { duration: 0.42, ease: easeOutExpo },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm"
            initial={reduced ? false : { opacity: 0 }}
            animate={reduced ? undefined : { opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={closeDialog}
            aria-hidden="true"
          />

          <PanelChrome
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-review-title"
            className="w-full max-w-2xl my-auto"
            blooms={PANEL_BLOOMS.teal}
            {...panelMotion}
          >
            <div className="relative z-10 px-6 sm:px-8 pt-5 pb-4 sm:pt-7 sm:pb-5 text-center">
              <button
                type="button"
                onClick={closeDialog}
                aria-label="Close"
                className="fixed sm:absolute right-4 top-4 z-30 grid h-11 w-11 place-items-center rounded-full bg-ink-950/70 text-white/80 ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15 hover:text-white"
              >
                <X size={18} />
              </button>

              <img
                src={site.logo}
                alt="CAL-ABA"
                className="mx-auto h-16 w-16 sm:h-24 sm:w-24 object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
              />
              <h2
                id="team-review-title"
                className="mt-3 font-bold tracking-tight text-text-light"
                style={{ fontSize: 'clamp(21px, 3.2vw, 27px)' }}
              >
                {status === 'done' ? 'Thank you!' : 'Review working at CAL-ABA'}
              </h2>
              <p className="mt-1.5 text-sm text-text-light/80">
                {status === 'done'
                  ? 'Your review is on its way to our leadership team.'
                  : 'Current and former team members — tell people what it is really like here.'}
              </p>
            </div>

            {status === 'done' ? (
              <div className="relative z-10 px-6 sm:px-10 pb-10 pt-2 text-center">
                <motion.div
                  className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal-bright/15 text-teal-bright ring-1 ring-teal-bright/40"
                  initial={reduced ? false : { scale: 0.5, opacity: 0 }}
                  animate={reduced ? undefined : { scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: easeOutExpo }}
                >
                  <Check size={30} strokeWidth={3} />
                </motion.div>
                <div className="mt-5 flex justify-center gap-1" aria-hidden="true">
                  {Array.from({ length: rating }, (_, i) => (
                    <Star key={i} size={20} className="fill-gold text-gold" />
                  ))}
                </div>
                <p className="mt-4 text-lg font-semibold text-text-light">
                  Thank you, {values.fullName.trim().split(' ')[0] || 'friend'}.
                </p>
                <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-text-light/80">
                  {consent
                    ? `Nothing goes live until we approve it. If we publish yours it will appear as “${
                        published || ANON_ATTRIBUTION
                      }” — never your full surname.`
                    : 'Thank you for the private feedback — it goes straight to our leadership and will not be published.'}
                </p>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="mt-8 inline-flex items-center rounded-full bg-gold px-8 py-3.5 text-[15px] font-semibold text-ink transition hover:scale-[1.03] hover:shadow-glow-gold"
                >
                  Back to the site
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="relative z-10 px-6 sm:px-8 pb-7 pt-1">
                {/* Honeypot — off-screen, unlabelled, skipped by keyboard and
                    autofill. Anything typed here is a bot. */}
                <div
                  className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden"
                  aria-hidden="true"
                >
                  <input
                    type="text"
                    name="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                {/* Star picker */}
                <fieldset className="mb-5 rounded-2xl bg-white/[0.05] px-5 py-4 text-center ring-1 ring-white/10">
                  <legend className="px-2 text-[13px] font-semibold text-text-light">
                    Your rating <span className="text-gold-bright">*</span>
                  </legend>
                  <div
                    className="mt-1 flex justify-center gap-1.5"
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setRating(n);
                          setErrors((e) => ({ ...e, rating: undefined }));
                        }}
                        onMouseEnter={() => setHoverRating(n)}
                        onFocus={() => setHoverRating(n)}
                        onBlur={() => setHoverRating(0)}
                        aria-label={`${n} star${n > 1 ? 's' : ''}`}
                        aria-pressed={rating === n}
                        className="rounded-lg p-1.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-bright"
                      >
                        <Star
                          size={32}
                          className={cn(
                            'transition-colors',
                            n <= shown ? 'fill-gold text-gold' : 'fill-transparent text-white/30',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 h-5 text-sm font-medium text-gold-bright">
                    {shown ? RATING_WORDS[shown] : ''}
                  </div>
                  {errors.rating && (
                    <p className="text-xs font-medium text-coral-bright">{errors.rating}</p>
                  )}
                </fieldset>

                {/* Current / former */}
                <fieldset className="mb-5">
                  <legend className="mb-1.5 block text-[13px] font-semibold text-text-light">
                    You are a
                  </legend>
                  <div
                    className="flex gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10"
                    role="radiogroup"
                    aria-label="Current or former team member"
                  >
                    {RELATIONSHIPS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={relationship === r}
                        onClick={() => setRelationship(r)}
                        className={cn(
                          'flex-1 rounded-full px-4 py-2.5 text-[13px] font-semibold transition',
                          relationship === r
                            ? 'bg-white/15 text-text-light ring-1 ring-white/20'
                            : 'text-text-light/60 hover:text-text-light/85',
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="tr-headline">Sum it up in a few words</Label>
                    <input
                      id="tr-headline"
                      value={values.headline}
                      onChange={(e) => set('headline', e.target.value)}
                      placeholder="e.g. Supervision that actually happens"
                      className={fieldBase}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="tr-review" required>
                      Your review
                    </Label>
                    <textarea
                      id="tr-review"
                      rows={5}
                      value={values.review}
                      onChange={(e) => set('review', e.target.value)}
                      placeholder="What is the caseload like? The supervision? What would you tell an RBT deciding whether to apply?"
                      className={cn(
                        fieldBase,
                        'resize-y min-h-[120px]',
                        errors.review && 'border-coral-bright',
                      )}
                    />
                    {errors.review && (
                      <p className="mt-1 text-xs font-medium text-coral-bright">{errors.review}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="tr-name" required>
                      Your full name
                    </Label>
                    <input
                      id="tr-name"
                      ref={firstFieldRef}
                      value={values.fullName}
                      onChange={(e) => set('fullName', e.target.value)}
                      autoComplete="name"
                      placeholder="Morgan Moise"
                      className={cn(fieldBase, errors.fullName && 'border-coral-bright')}
                    />
                    {errors.fullName ? (
                      <p className="mt-1 text-xs font-medium text-coral-bright">
                        {errors.fullName}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs leading-relaxed text-text-light/55">
                        So we know who wrote it. Only ever published as a first name and last
                        initial.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="tr-email" required>
                      Email
                    </Label>
                    <input
                      id="tr-email"
                      type="email"
                      inputMode="email"
                      value={values.email}
                      onChange={(e) => set('email', e.target.value)}
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={cn(fieldBase, errors.email && 'border-coral-bright')}
                    />
                    {errors.email ? (
                      <p className="mt-1 text-xs font-medium text-coral-bright">{errors.email}</p>
                    ) : (
                      <p className="mt-1.5 text-xs leading-relaxed text-text-light/55">
                        For verification only — never published.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="tr-role">Your role</Label>
                    <input
                      id="tr-role"
                      value={values.role}
                      onChange={(e) => set('role', e.target.value)}
                      placeholder="RBT, Lead RBT, BCBA…"
                      className={fieldBase}
                    />
                  </div>

                  <div>
                    <Label htmlFor="tr-tenure">Time at CAL-ABA</Label>
                    <input
                      id="tr-tenure"
                      value={values.tenure}
                      onChange={(e) => set('tenure', e.target.value)}
                      placeholder="2 years"
                      className={fieldBase}
                    />
                  </div>
                </div>

                {/* Anonymity — the consequence is spelled out and updates live */}
                <label
                  htmlFor="tr-anonymous"
                  className={cn(
                    'mt-5 flex cursor-pointer gap-3 rounded-2xl px-4 py-3.5 ring-1 transition',
                    anonymous ? 'bg-white/[0.09] ring-white/25' : 'bg-white/[0.04] ring-white/15',
                  )}
                >
                  <input
                    id="tr-anonymous"
                    type="checkbox"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#2FE0D8]"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold text-text-light">
                      <EyeOff size={15} className="shrink-0 text-teal-bright" aria-hidden="true" />
                      Publish this anonymously
                    </span>
                    <span
                      id="tr-anon-hint"
                      aria-live="polite"
                      className="mt-1.5 block text-sm leading-relaxed text-text-light/75"
                    >
                      {anonymous ? (
                        <>
                          Published as{' '}
                          <strong className="font-semibold text-teal-bright">
                            “Anonymous team member”
                          </strong>{' '}
                          — your name is never shown.
                        </>
                      ) : published ? (
                        <>
                          Published as{' '}
                          <strong className="font-semibold text-teal-bright">“{published}”</strong>{' '}
                          — we never show your full surname.
                        </>
                      ) : (
                        <>
                          Published as your first name and last initial, e.g.{' '}
                          <strong className="font-semibold text-teal-bright">“Morgan M.”</strong> —
                          we never show your full surname.
                        </>
                      )}
                    </span>
                  </span>
                </label>

                {/* Publication consent */}
                <label
                  htmlFor="tr-consent"
                  className={cn(
                    'mt-3 flex cursor-pointer gap-3 rounded-2xl px-4 py-3.5 ring-1 transition',
                    consent ? 'bg-teal-bright/10 ring-teal-bright/40' : 'bg-white/[0.04] ring-white/15',
                  )}
                >
                  <input
                    id="tr-consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#2FE0D8]"
                  />
                  <span className="text-sm leading-relaxed text-text-light/85">
                    CAL-ABA may publish this review on their careers page, credited as described
                    above. Untick to send it as private feedback instead.
                  </span>
                </label>

                <div className="mt-6 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
                  <p className="text-xs leading-relaxed text-text-light/60">
                    Please don&rsquo;t include client names or any protected health information.
                  </p>
                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-8 py-3.5 text-[15px] font-semibold text-ink transition hover:scale-[1.03] hover:shadow-glow-gold disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 sm:w-auto"
                  >
                    {status === 'sending' ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Sending…
                      </>
                    ) : (
                      'Submit review'
                    )}
                  </button>
                </div>
              </form>
            )}
          </PanelChrome>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, Star, X } from 'lucide-react';
import { site } from '@/content/site';
import { SERVICES } from '@/content/services';
import { fieldBase, Label, PANEL_BLOOMS, PanelChrome, Select } from '@/lib/ui';
import { MIN_FORM_AGE_MS, postReview } from '@/lib/api';
import { useReview } from '@/lib/dialogs';
import { usePrefersReducedMotion, easeOutExpo } from '@/lib/motion';
import { cn } from '@/lib/cn';

type Values = {
  name: string;
  credit: string;
  email: string;
  relationship: string;
  location: string;
  service: string;
  headline: string;
  review: string;
};

const EMPTY: Values = {
  name: '',
  credit: 'First name and last initial',
  email: '',
  relationship: 'Parent / caregiver',
  location: '',
  service: '',
  headline: '',
  review: '',
};

const FIELD_LABELS: [keyof Values, string][] = [
  ['name', 'Name'],
  ['credit', 'How to credit them'],
  ['email', 'Email'],
  ['relationship', 'Relationship to CAL-ABA'],
  ['location', 'City / county'],
  ['service', 'Service received'],
  ['headline', 'Headline'],
  ['review', 'Review'],
];

const CREDITS = [
  'First name and last initial',
  'Parent of a [age]-year-old',
  'Post anonymously',
  'Use my full name',
];

const RELATIONSHIPS = [
  'Parent / caregiver',
  'Adult client',
  'Family member',
  'School or community partner',
  'Team member',
];

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

function asPlainText(v: Values, rating: number, consent: boolean) {
  const lines = FIELD_LABELS.map(([key, label]) => {
    const val = v[key].trim() || '—';
    return key === 'review' ? `\n${label}:\n${val}` : `${label}: ${val}`;
  });
  return [
    'New review submitted on the CAL-ABA website',
    '',
    `Rating: ${rating}/5 (${RATING_WORDS[rating]})`,
    ...lines,
    '',
    `Permission to publish: ${consent ? 'YES' : 'NO — private feedback only'}`,
    `Submitted: ${new Date().toLocaleString()}`,
  ].join('\n');
}

export default function ReviewDialog() {
  const { open, closeDialog } = useReview();
  const reduced = usePrefersReducedMotion();

  const [values, setValues] = useState<Values>(EMPTY);
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
    if (!values.name.trim()) next.name = 'Please tell us your name.';
    if (!values.email.trim()) next.email = 'We need an email to verify your review.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      next.email = 'That email address looks incomplete.';
    if (!values.review.trim()) next.review = 'Please write a few words about your experience.';
    else if (values.review.trim().length < 20)
      next.review = 'Just a little more detail, please.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    if (!validate()) {
      // The submit button can sit far below the first bad field on a phone,
      // so bring the error into view instead of silently doing nothing.
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

    const subject = `New ${rating}-star review — ${values.name.trim() || 'Anonymous'}`;
    const mailFallback = () => {
      window.location.href = `mailto:${site.contact.email}?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(asPlainText(values, rating, consent))}`;
    };

    try {
      /* A silent spam drop still answers 200 {ok:true,id:null} — the sender
         must never learn which submissions were dropped, so we treat it
         exactly like a success. */
      await postReview({
        rating,
        headline: values.headline.trim(),
        review: values.review.trim(),
        name: values.name.trim(),
        credit: values.credit,
        email: values.email.trim(),
        relationship: values.relationship,
        location: values.location.trim(),
        service: values.service,
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
            aria-labelledby="review-title"
            className="w-full max-w-2xl my-auto"
            blooms={PANEL_BLOOMS.gold}
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
                id="review-title"
                className="mt-3 font-bold tracking-tight text-text-light"
                style={{ fontSize: 'clamp(21px, 3.2vw, 27px)' }}
              >
                {status === 'done' ? 'Thank you!' : 'Share your experience'}
              </h2>
              <p className="mt-1.5 text-sm text-text-light/80">
                {status === 'done'
                  ? 'Your review is on its way to our team.'
                  : 'Your words help other families decide. It takes about two minutes.'}
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
                  Thank you, {values.name.trim().split(' ')[0] || 'friend'}.
                </p>
                <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-text-light/80">
                  {consent
                    ? 'We read every review. If we’d like to feature yours on the site, we’ll email you first to confirm exactly how you’d like to be credited.'
                    : 'Thank you for the private feedback — it goes straight to our clinical leadership and will not be published.'}
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
                <div className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="r-headline">Sum it up in a few words</Label>
                    <input
                      id="r-headline"
                      value={values.headline}
                      onChange={(e) => set('headline', e.target.value)}
                      placeholder="e.g. They finally listened to my son"
                      className={fieldBase}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="r-review" required>
                      Your review
                    </Label>
                    <textarea
                      id="r-review"
                      rows={5}
                      value={values.review}
                      onChange={(e) => set('review', e.target.value)}
                      placeholder="What was your experience like? What changed for your family? What would you tell another parent who is deciding?"
                      className={cn(fieldBase, 'resize-y min-h-[120px]', errors.review && 'border-coral-bright')}
                    />
                    {errors.review && (
                      <p className="mt-1 text-xs font-medium text-coral-bright">{errors.review}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="r-name" required>
                      Your name
                    </Label>
                    <input
                      id="r-name"
                      ref={firstFieldRef}
                      value={values.name}
                      onChange={(e) => set('name', e.target.value)}
                      autoComplete="name"
                      placeholder="Jamie Rivera"
                      className={cn(fieldBase, errors.name && 'border-coral-bright')}
                    />
                    {errors.name && (
                      <p className="mt-1 text-xs font-medium text-coral-bright">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="r-email" required>
                      Email
                    </Label>
                    <input
                      id="r-email"
                      type="email"
                      inputMode="email"
                      value={values.email}
                      onChange={(e) => set('email', e.target.value)}
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={cn(fieldBase, errors.email && 'border-coral-bright')}
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs font-medium text-coral-bright">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="r-credit">If published, credit me as</Label>
                    <Select id="r-credit" value={values.credit} onChange={(v) => set('credit', v)}>
                      {CREDITS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="r-relationship">Your relationship to CAL-ABA</Label>
                    <Select
                      id="r-relationship"
                      value={values.relationship}
                      onChange={(v) => set('relationship', v)}
                    >
                      {RELATIONSHIPS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="r-service">Service received</Label>
                    <Select id="r-service" value={values.service} onChange={(v) => set('service', v)}>
                      <option value="">Select a service</option>
                      {SERVICES.map((s) => (
                        <option key={s.id}>{s.title}</option>
                      ))}
                      <option>Several services</option>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="r-location">City / county</Label>
                    <input
                      id="r-location"
                      value={values.location}
                      onChange={(e) => set('location', e.target.value)}
                      placeholder="Broward County"
                      className={fieldBase}
                    />
                  </div>
                </div>

                {/* Publication consent */}
                <label
                  htmlFor="r-consent"
                  className={cn(
                    'mt-5 flex cursor-pointer gap-3 rounded-2xl px-4 py-3.5 ring-1 transition',
                    consent
                      ? 'bg-teal-bright/10 ring-teal-bright/40'
                      : 'bg-white/[0.04] ring-white/15',
                  )}
                >
                  <input
                    id="r-consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#2FE0D8]"
                  />
                  <span className="text-sm leading-relaxed text-text-light/85">
                    CAL-ABA may publish this review on their website, credited as I chose above.
                    Untick to send it as private feedback instead.
                  </span>
                </label>

                <div className="mt-6 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
                  <p className="text-xs leading-relaxed text-text-light/60">
                    Please don&rsquo;t include your child&rsquo;s full name or health details.
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

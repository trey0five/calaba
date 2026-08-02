import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Loader2, Mail, Phone, X } from 'lucide-react';
import { site } from '@/content/site';
import { GrainOverlay } from '@/components/primitives/AuroraField';
import { useConsultation } from '@/lib/dialogs';
import { usePrefersReducedMotion, easeOutExpo } from '@/lib/motion';
import { cn } from '@/lib/cn';

type Values = {
  name: string;
  email: string;
  phone: string;
  contactMethod: string;
  bestTime: string;
  childName: string;
  childAge: string;
  insurance: string;
  interest: string;
  message: string;
};

const EMPTY: Values = {
  name: '',
  email: '',
  phone: '',
  contactMethod: 'Email',
  bestTime: 'Morning (8am–12pm)',
  childName: '',
  childAge: '',
  insurance: '',
  interest: '',
  message: '',
};

/** Field order and labels shared by the email payload and the mail fallback. */
const FIELD_LABELS: [keyof Values, string][] = [
  ['name', 'Parent / caregiver name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['contactMethod', 'Preferred contact method'],
  ['bestTime', 'Best time to reach'],
  ['childName', "Child's first name"],
  ['childAge', "Child's age"],
  ['insurance', 'Insurance'],
  ['interest', 'Interested in'],
  ['message', 'Message'],
];

const INSURANCES = [
  'Aetna',
  'Florida Blue',
  'Step Up For Students',
  'Cigna',
  'Other / not sure',
  'Private pay',
];

const INTERESTS = [
  'In-home ABA therapy',
  'School-based ABA',
  'Community-based ABA',
  'Parent & caregiver training',
  'Sibling training',
  'Intensive potty training',
  'Severe behavior intervention',
  'Educational advocacy / IEP support',
  'Social skills group',
  'Summer camp',
  'Adult & transition services',
  'Not sure yet — help me decide',
];

const AGES = [
  'Under 2',
  '2–4',
  '5–7',
  '8–11',
  '12–15',
  '16–17',
  '18+ (adult services)',
];

/** Glassy field on the ink panel. */
const fieldBase =
  'w-full rounded-xl border border-white/15 bg-white/[0.07] px-4 py-3 text-base text-white placeholder:text-white/50 outline-none transition focus:border-teal-bright focus:bg-white/[0.11] focus:ring-2 focus:ring-teal-bright/30';

/** (954) 599-2260 as you type. */
function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Every field, blanks included, so nothing silently goes missing. */
function templateParams(v: Values) {
  const filled = (s: string) => (s.trim() ? s.trim() : '—');
  return {
    name: filled(v.name),
    email: filled(v.email),
    phone: filled(v.phone),
    contact_method: filled(v.contactMethod),
    best_time: filled(v.bestTime),
    child_name: filled(v.childName),
    child_age: filled(v.childAge),
    insurance: filled(v.insurance),
    interest: filled(v.interest),
    message: filled(v.message),
    submitted_at: new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    }),
    reply_to: v.email.trim(),
    subject: `Consultation request — ${v.name.trim() || 'New enquiry'}`,
  };
}

function asPlainText(v: Values) {
  const lines = FIELD_LABELS.map(([key, label]) => {
    const val = v[key].trim() || '—';
    return key === 'message' ? `\n${label}:\n${val}` : `${label}: ${val}`;
  });
  return [
    'New consultation request from the CAL-ABA website',
    '',
    ...lines,
    '',
    `Submitted: ${new Date().toLocaleString()}`,
  ].join('\n');
}

/** Select with our own chevron — native arrows don't read on the glass field. */
function Select({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(fieldBase, 'field-select appearance-none pr-11 cursor-pointer')}
      >
        {children}
      </select>
      <ChevronDown
        size={18}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/60"
        aria-hidden="true"
      />
    </div>
  );
}

function Label({ htmlFor, children, required }: { htmlFor: string; children: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5 text-[13px] font-semibold text-text-light">
      {children}
      {required && <span className="text-gold-bright"> *</span>}
    </label>
  );
}

export default function ConsultationDialog() {
  const { open, closeDialog } = useConsultation();
  const reduced = usePrefersReducedMotion();

  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');

  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const set = (key: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  /* Lock scroll, remember focus, restore it on close. */
  useEffect(() => {
    if (!open) return;
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

  /* Escape to close + focus trap. */
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

  /* Reset a completed form shortly after it closes. */
  useEffect(() => {
    if (open || status !== 'done') return;
    const t = window.setTimeout(() => {
      setValues(EMPTY);
      setStatus('idle');
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, status]);

  const validate = () => {
    const next: Partial<Record<keyof Values, string>> = {};
    if (!values.name.trim()) next.name = 'Please tell us your name.';
    if (!values.email.trim()) next.email = 'We need an email to write back.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      next.email = 'That email address looks incomplete.';
    if (!values.phone.trim()) next.phone = 'A phone number helps us reach you faster.';
    else if (values.phone.replace(/\D/g, '').length !== 10)
      next.phone = 'Please enter a 10-digit number including area code.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const mailFallback = (v: Values) => {
    window.location.href = `mailto:${site.contact.email}?subject=${encodeURIComponent(
      `Consultation request — ${v.name.trim()}`,
    )}&body=${encodeURIComponent(asPlainText(v))}`;
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

    const { emailjs, formEndpoint } = site.contact;
    const params = templateParams(values);

    try {
      if (emailjs.serviceId && emailjs.templateId && emailjs.publicKey) {
        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: emailjs.serviceId,
            template_id: emailjs.templateId,
            user_id: emailjs.publicKey,
            template_params: params,
          }),
        });
        if (!res.ok) throw new Error(`EmailJS responded ${res.status}`);
      } else if (formEndpoint) {
        const res = await fetch(formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ ...params, _subject: params.subject }),
        });
        if (!res.ok) throw new Error(`Form endpoint responded ${res.status}`);
      } else {
        // Nothing configured yet — hand off to the mail client so the
        // request still reaches the inbox.
        mailFallback(values);
      }
    } catch {
      mailFallback(values);
    }

    setStatus('done');
  };

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

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="consultation-title"
            className="relative w-full max-w-2xl my-auto overflow-hidden rounded-3xl shadow-cosmic ring-1 ring-white/10"
            style={{
              background:
                'linear-gradient(180deg, #140A2E 0%, #1C0E3E 55%, #241348 100%)',
            }}
            {...panelMotion}
          >
            {/* Aurora blooms + grain, same language as the page sections */}
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                background:
                  'radial-gradient(closest-side, rgba(47,224,216,0.30), transparent 70%) -15% -10% / 65% 55% no-repeat, radial-gradient(closest-side, rgba(255,111,176,0.28), transparent 70%) 112% -6% / 62% 52% no-repeat, radial-gradient(closest-side, rgba(255,196,77,0.20), transparent 70%) 50% 112% / 80% 45% no-repeat',
              }}
              aria-hidden="true"
            />
            <GrainOverlay opacity={0.06} />

            {/* Header: logo + title */}
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
                className="mx-auto h-16 w-16 sm:h-32 sm:w-32 object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
              />
              <h2
                id="consultation-title"
                className="mt-3 font-bold tracking-tight text-text-light"
                style={{ fontSize: 'clamp(21px, 3.2vw, 27px)' }}
              >
                {status === 'done' ? 'Thank you!' : 'Schedule a consultation'}
              </h2>
              <p className="mt-1.5 text-sm text-text-light/80">
                {status === 'done'
                  ? 'Your request is on its way to our team.'
                  : 'Tell us a little about your family — we answer every enquiry within one business day.'}
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
                <p className="mt-5 text-lg font-semibold text-text-light">
                  We&rsquo;ve got it, {values.name.trim().split(' ')[0] || 'friend'}.
                </p>
                <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-text-light/80">
                  A member of our clinical team will reach out by{' '}
                  <span className="font-semibold text-gold-bright">
                    {values.contactMethod.toLowerCase()}
                  </span>{' '}
                  within one business day. If it&rsquo;s urgent, call us any time.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-5">
                  <a
                    href={`tel:${site.contact.phone.replace(/[^\d+]/g, '')}`}
                    className="inline-flex items-center gap-2 text-[15px] font-semibold text-text-light transition hover:text-magenta-bright"
                  >
                    <Phone size={17} className="text-magenta-bright" />
                    {site.contact.phone}
                  </a>
                  <a
                    href={`mailto:${site.contact.email}`}
                    className="inline-flex items-center gap-2 text-[15px] font-semibold text-text-light transition hover:text-teal-bright"
                  >
                    <Mail size={17} className="text-teal-bright" />
                    {site.contact.email}
                  </a>
                </div>

                <button
                  type="button"
                  onClick={closeDialog}
                  className="mt-8 inline-flex items-center rounded-full bg-gold px-8 py-3.5 text-[15px] font-semibold text-ink transition hover:scale-[1.03] hover:shadow-glow-gold"
                >
                  Back to the site
                </button>
              </div>
            ) : (
              <form
                onSubmit={onSubmit}
                noValidate
                className="relative z-10 px-6 sm:px-8 pb-7 pt-1"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="c-name" required>
                      Parent / caregiver name
                    </Label>
                    <input
                      id="c-name"
                      ref={firstFieldRef}
                      value={values.name}
                      onChange={(e) => set('name', e.target.value)}
                      autoComplete="name"
                      placeholder="Jamie Rivera"
                      aria-invalid={!!errors.name}
                      className={cn(fieldBase, errors.name && 'border-coral-bright focus:border-coral-bright focus:ring-coral-bright/30')}
                    />
                    {errors.name && <p className="mt-1 text-xs font-medium text-coral-bright">{errors.name}</p>}
                  </div>

                  <div>
                    <Label htmlFor="c-email" required>
                      Email
                    </Label>
                    <input
                      id="c-email"
                      type="email"
                      inputMode="email"
                      value={values.email}
                      onChange={(e) => set('email', e.target.value)}
                      autoComplete="email"
                      placeholder="you@example.com"
                      aria-invalid={!!errors.email}
                      className={cn(fieldBase, errors.email && 'border-coral-bright focus:border-coral-bright focus:ring-coral-bright/30')}
                    />
                    {errors.email && <p className="mt-1 text-xs font-medium text-coral-bright">{errors.email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="c-phone" required>
                      Phone
                    </Label>
                    <input
                      id="c-phone"
                      type="tel"
                      inputMode="tel"
                      value={values.phone}
                      onChange={(e) => set('phone', formatPhone(e.target.value))}
                      autoComplete="tel"
                      placeholder="(954) 555-0134"
                      aria-invalid={!!errors.phone}
                      className={cn(fieldBase, errors.phone && 'border-coral-bright focus:border-coral-bright focus:ring-coral-bright/30')}
                    />
                    {errors.phone && <p className="mt-1 text-xs font-medium text-coral-bright">{errors.phone}</p>}
                  </div>

                  <div>
                    <Label htmlFor="c-method">Preferred contact method</Label>
                    <Select id="c-method" value={values.contactMethod} onChange={(v) => set('contactMethod', v)}>
                      <option>Email</option>
                      <option>Phone call</option>
                      <option>Text message</option>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="c-time">Best time to reach you</Label>
                    <Select id="c-time" value={values.bestTime} onChange={(v) => set('bestTime', v)}>
                      <option>Morning (8am–12pm)</option>
                      <option>Afternoon (12pm–4pm)</option>
                      <option>Evening (4pm–7pm)</option>
                      <option>Any time</option>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="c-child">Child&rsquo;s first name</Label>
                    <input
                      id="c-child"
                      value={values.childName}
                      onChange={(e) => set('childName', e.target.value)}
                      placeholder="Optional"
                      className={fieldBase}
                    />
                  </div>

                  <div>
                    <Label htmlFor="c-age">Child&rsquo;s age</Label>
                    <Select id="c-age" value={values.childAge} onChange={(v) => set('childAge', v)}>
                      <option value="">Select an age range</option>
                      {AGES.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="c-insurance">Insurance</Label>
                    <Select id="c-insurance" value={values.insurance} onChange={(v) => set('insurance', v)}>
                      <option value="">Select your plan</option>
                      {INSURANCES.map((i) => (
                        <option key={i}>{i}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="c-interest">What are you interested in?</Label>
                    <Select id="c-interest" value={values.interest} onChange={(v) => set('interest', v)}>
                      <option value="">Select a service</option>
                      {INTERESTS.map((i) => (
                        <option key={i}>{i}</option>
                      ))}
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="c-message">Anything you&rsquo;d like us to know?</Label>
                    <textarea
                      id="c-message"
                      rows={3}
                      value={values.message}
                      onChange={(e) => set('message', e.target.value)}
                      placeholder="Diagnosis, current services, goals, questions — whatever is helpful."
                      className={cn(fieldBase, 'resize-y min-h-[88px]')}
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
                  <p className="text-xs leading-relaxed text-text-light/60">
                    Your information is used only to contact you about services.
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
                      'Request my consultation'
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

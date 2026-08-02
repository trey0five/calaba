import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { site } from '@/content/site';
import { GrainOverlay } from '@/components/primitives/AuroraField';
import { useApplication } from '@/lib/dialogs';
import { usePrefersReducedMotion, easeOutExpo } from '@/lib/motion';
import { cn } from '@/lib/cn';

type Values = {
  name: string;
  email: string;
  phone: string;
  dob: string;
  street: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  position: string;
  wage: string;
  rightToWork: string;
  references: string;
};

const EMPTY: Values = {
  name: '',
  email: '',
  phone: '',
  dob: '',
  street: '',
  city: '',
  region: '',
  postal: '',
  country: 'United States',
  position: '',
  wage: '',
  rightToWork: '',
  references: '',
};

/** Field order + labels shared by the email payload and the mail fallback. */
const FIELD_LABELS: [keyof Values, string][] = [
  ['name', 'Name'],
  ['email', 'Email'],
  ['phone', 'Phone number'],
  ['dob', 'Date of birth'],
  ['street', 'Street address'],
  ['city', 'City'],
  ['region', 'Region / State / Province'],
  ['postal', 'Postal / ZIP code'],
  ['country', 'Country'],
  ['position', 'Position applying for'],
  ['wage', 'Desired hourly / salary wage'],
  ['rightToWork', 'Legal right to work in the US'],
  ['references', 'References'],
];

const POSITIONS = ['RBT', 'BCaBA', 'BCBA'];

const MAX_RESUME_MB = 5;
const RESUME_TYPES = ['.pdf', '.doc', '.docx', '.rtf', '.txt'];

const fieldBase =
  'w-full rounded-xl border border-white/15 bg-white/[0.07] px-4 py-3 text-base text-white placeholder:text-white/50 outline-none transition focus:border-teal-bright focus:bg-white/[0.11] focus:ring-2 focus:ring-teal-bright/30';

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function prettyDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Every field, blanks included, so nothing silently goes missing. */
function templateParams(v: Values, resumeLink: string, resumeName: string) {
  const filled = (s: string) => (s.trim() ? s.trim() : '—');
  return {
    name: filled(v.name),
    email: filled(v.email),
    phone: filled(v.phone),
    dob: filled(prettyDate(v.dob)),
    street: filled(v.street),
    city: filled(v.city),
    region: filled(v.region),
    postal: filled(v.postal),
    country: filled(v.country),
    address_full: [
      v.street.trim(),
      [v.city.trim(), v.region.trim()].filter(Boolean).join(', '),
      [v.postal.trim(), v.country.trim()].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join('\n') || '—',
    position: filled(v.position),
    wage: filled(v.wage),
    right_to_work: filled(v.rightToWork),
    references: filled(v.references),
    resume_name: resumeName || 'No file attached',
    resume_link: resumeLink || 'Not uploaded — please request it from the applicant',
    submitted_at: new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    }),
    reply_to: v.email.trim(),
    subject: `Job application — ${v.position || 'Applicant'} — ${v.name.trim()}`,
  };
}

function asPlainText(v: Values, resumeLink: string, resumeName: string) {
  const lines = FIELD_LABELS.map(([key, label]) => {
    const val = key === 'dob' ? prettyDate(v[key]) : v[key].trim();
    return key === 'references'
      ? `\n${label}:\n${val || '—'}`
      : `${label}: ${val || '—'}`;
  });
  return [
    'New job application from the CAL-ABA website',
    '',
    ...lines,
    '',
    `Résumé: ${resumeName || 'No file attached'}`,
    resumeLink ? `Download: ${resumeLink}` : 'The applicant still needs to send their résumé.',
    '',
    `Submitted: ${new Date().toLocaleString()}`,
  ].join('\n');
}

function Label({ htmlFor, children, required }: { htmlFor: string; children: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5 text-[13px] font-semibold text-text-light">
      {children}
      {required && <span className="text-gold-bright"> *</span>}
    </label>
  );
}

function Field({
  id,
  label,
  required,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-coral-bright">{error}</p>}
    </div>
  );
}

export default function ApplicationDialog() {
  const { open, position: presetPosition, closeDialog } = useApplication();
  const reduced = usePrefersReducedMotion();

  const [values, setValues] = useState<Values>(EMPTY);
  const [resume, setResume] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Values | 'resume', string>>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');

  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const set = (key: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  useEffect(() => {
    if (!open || !presetPosition) return;
    setValues((v) => (v.position ? v : { ...v, position: presetPosition }));
  }, [open, presetPosition]);

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
        'a[href], button:not([disabled]), input:not([type="file"]), select, textarea, [tabindex]:not([tabindex="-1"])',
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
      setResume(null);
      setStatus('idle');
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, status]);

  const onPickFile = (file: File | null) => {
    if (!file) {
      setResume(null);
      return;
    }
    const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
    if (!RESUME_TYPES.includes(ext)) {
      setErrors((e) => ({ ...e, resume: `Please upload a ${RESUME_TYPES.join(', ')} file.` }));
      return;
    }
    if (file.size > MAX_RESUME_MB * 1024 * 1024) {
      setErrors((e) => ({ ...e, resume: `That file is over ${MAX_RESUME_MB}MB — please attach a smaller one.` }));
      return;
    }
    setErrors((e) => ({ ...e, resume: undefined }));
    setResume(file);
  };

  const validate = () => {
    const next: Partial<Record<keyof Values | 'resume', string>> = {};
    if (!values.name.trim()) next.name = 'Please enter your first and last name.';
    if (!values.email.trim()) next.email = 'We need an email to reply to.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      next.email = 'That email address looks incomplete.';
    if (!values.phone.trim()) next.phone = 'A phone number is required.';
    else if (values.phone.replace(/\D/g, '').length !== 10)
      next.phone = 'Please enter a 10-digit number including area code.';
    if (!values.dob) next.dob = 'Please enter your date of birth.';
    else {
      const dob = new Date(values.dob);
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 16) next.dob = 'Applicants must be at least 16 years old.';
      else if (age > 100) next.dob = 'Please check that date.';
    }
    if (!values.street.trim()) next.street = 'Street address is required.';
    if (!values.city.trim()) next.city = 'City is required.';
    if (!values.region.trim()) next.region = 'State or province is required.';
    if (!values.postal.trim()) next.postal = 'Postal / ZIP code is required.';
    if (!values.country.trim()) next.country = 'Country is required.';
    if (!values.position) next.position = 'Please choose a position.';
    if (!values.wage.trim()) next.wage = 'Please share your desired wage.';
    if (!values.rightToWork) next.rightToWork = 'Please answer this question.';
    if (!values.references.trim()) next.references = 'Please list two references with phone numbers.';
    if (!resume) next.resume = 'Please attach your CV / résumé.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Cloudinary unsigned upload -> shareable link for the email. */
  const uploadResume = async (file: File): Promise<string> => {
    const { cloudName, uploadPreset } = site.contact.resumeUpload;
    if (!cloudName || !uploadPreset) return '';
    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', uploadPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    const json = (await res.json()) as { secure_url?: string };
    return json.secure_url ?? '';
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
    let resumeLink = '';
    try {
      if (resume) resumeLink = await uploadResume(resume);
    } catch {
      /* keep going — the email will say the résumé still needs collecting */
    }

    const params = templateParams(values, resumeLink, resume?.name ?? '');
    const mailFallback = () => {
      window.location.href = `mailto:${site.contact.email}?subject=${encodeURIComponent(
        params.subject,
      )}&body=${encodeURIComponent(asPlainText(values, resumeLink, resume?.name ?? ''))}`;
    };

    try {
      if (emailjs.serviceId && emailjs.applicationTemplateId && emailjs.publicKey) {
        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: emailjs.serviceId,
            template_id: emailjs.applicationTemplateId,
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
        mailFallback();
      }
    } catch {
      mailFallback();
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
            aria-labelledby="application-title"
            className="relative w-full max-w-3xl my-auto overflow-hidden rounded-3xl shadow-cosmic ring-1 ring-white/10"
            style={{ background: 'linear-gradient(180deg, #140A2E 0%, #1C0E3E 55%, #241348 100%)' }}
            {...panelMotion}
          >
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                background:
                  'radial-gradient(closest-side, rgba(47,224,216,0.30), transparent 70%) -15% -10% / 65% 55% no-repeat, radial-gradient(closest-side, rgba(255,196,77,0.26), transparent 70%) 112% -6% / 62% 52% no-repeat, radial-gradient(closest-side, rgba(255,111,176,0.20), transparent 70%) 50% 112% / 80% 45% no-repeat',
              }}
              aria-hidden="true"
            />
            <GrainOverlay opacity={0.06} />

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
                id="application-title"
                className="mt-3 font-bold tracking-tight text-text-light"
                style={{ fontSize: 'clamp(21px, 3.2vw, 27px)' }}
              >
                {status === 'done' ? 'Application received!' : 'Join our team'}
              </h2>
              <p className="mt-1.5 text-sm text-text-light/80">
                {status === 'done'
                  ? 'Thank you for applying to CAL-ABA.'
                  : 'RBT, BCaBA and BCBA applications — tell us about yourself and attach your résumé.'}
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
                  Thank you, {values.name.trim().split(' ')[0] || 'friend'}!
                </p>
                <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-text-light/80">
                  Your{' '}
                  <span className="font-semibold text-gold-bright">
                    {values.position || 'application'}
                  </span>{' '}
                  application is with our clinical team. If your experience matches what
                  we&rsquo;re looking for, we&rsquo;ll be in touch to arrange an interview.
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="a-name" label="Name" required error={errors.name} className="sm:col-span-2">
                    <input
                      id="a-name"
                      ref={firstFieldRef}
                      value={values.name}
                      onChange={(e) => set('name', e.target.value)}
                      autoComplete="name"
                      placeholder="First and last name"
                      className={cn(fieldBase, errors.name && 'border-coral-bright')}
                    />
                  </Field>

                  <Field id="a-email" label="Email" required error={errors.email}>
                    <input
                      id="a-email"
                      type="email"
                      inputMode="email"
                      value={values.email}
                      onChange={(e) => set('email', e.target.value)}
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={cn(fieldBase, errors.email && 'border-coral-bright')}
                    />
                  </Field>

                  <Field id="a-phone" label="Phone number" required error={errors.phone}>
                    <input
                      id="a-phone"
                      type="tel"
                      inputMode="tel"
                      value={values.phone}
                      onChange={(e) => set('phone', formatPhone(e.target.value))}
                      autoComplete="tel"
                      placeholder="(954) 555-0134"
                      className={cn(fieldBase, errors.phone && 'border-coral-bright')}
                    />
                  </Field>

                  <Field id="a-dob" label="Date of birth" required error={errors.dob}>
                    <input
                      id="a-dob"
                      type="date"
                      value={values.dob}
                      onChange={(e) => set('dob', e.target.value)}
                      className={cn(fieldBase, 'field-select', errors.dob && 'border-coral-bright')}
                    />
                  </Field>

                  <Field id="a-position" label="Which position are you interested in?" required error={errors.position}>
                    <div className="relative">
                      <select
                        id="a-position"
                        value={values.position}
                        onChange={(e) => set('position', e.target.value)}
                        className={cn(fieldBase, 'field-select appearance-none pr-11 cursor-pointer', errors.position && 'border-coral-bright')}
                      >
                        <option value="">Select a position</option>
                        {POSITIONS.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                      <ChevronDown
                        size={18}
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/60"
                        aria-hidden="true"
                      />
                    </div>
                  </Field>

                  <Field id="a-street" label="Street address" required error={errors.street} className="sm:col-span-2">
                    <input
                      id="a-street"
                      value={values.street}
                      onChange={(e) => set('street', e.target.value)}
                      autoComplete="street-address"
                      placeholder="123 Main St, Apt 4"
                      className={cn(fieldBase, errors.street && 'border-coral-bright')}
                    />
                  </Field>

                  <Field id="a-city" label="City" required error={errors.city}>
                    <input
                      id="a-city"
                      value={values.city}
                      onChange={(e) => set('city', e.target.value)}
                      autoComplete="address-level2"
                      placeholder="Fort Lauderdale"
                      className={cn(fieldBase, errors.city && 'border-coral-bright')}
                    />
                  </Field>

                  <Field id="a-region" label="Region / State / Province" required error={errors.region}>
                    <input
                      id="a-region"
                      value={values.region}
                      onChange={(e) => set('region', e.target.value)}
                      autoComplete="address-level1"
                      placeholder="Florida"
                      className={cn(fieldBase, errors.region && 'border-coral-bright')}
                    />
                  </Field>

                  <Field id="a-postal" label="Postal / ZIP code" required error={errors.postal}>
                    <input
                      id="a-postal"
                      value={values.postal}
                      onChange={(e) => set('postal', e.target.value)}
                      autoComplete="postal-code"
                      placeholder="33301"
                      className={cn(fieldBase, errors.postal && 'border-coral-bright')}
                    />
                  </Field>

                  <Field id="a-country" label="Country" required error={errors.country}>
                    <input
                      id="a-country"
                      value={values.country}
                      onChange={(e) => set('country', e.target.value)}
                      autoComplete="country-name"
                      className={cn(fieldBase, errors.country && 'border-coral-bright')}
                    />
                  </Field>

                  <Field id="a-wage" label="Desired hourly / salary wage" required error={errors.wage}>
                    <input
                      id="a-wage"
                      value={values.wage}
                      onChange={(e) => set('wage', e.target.value)}
                      placeholder="e.g. $28/hr"
                      className={cn(fieldBase, errors.wage && 'border-coral-bright')}
                    />
                  </Field>

                  <Field
                    id="a-rtw"
                    label="If hired, can you provide proof of your legal right to work in the United States?"
                    required
                    error={errors.rightToWork}
                  >
                    <div className="relative">
                      <select
                        id="a-rtw"
                        value={values.rightToWork}
                        onChange={(e) => set('rightToWork', e.target.value)}
                        className={cn(fieldBase, 'field-select appearance-none pr-11 cursor-pointer', errors.rightToWork && 'border-coral-bright')}
                      >
                        <option value="">Select an answer</option>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                      <ChevronDown
                        size={18}
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/60"
                        aria-hidden="true"
                      />
                    </div>
                  </Field>

                  <Field
                    id="a-refs"
                    label="List two personal or professional references (include phone numbers)"
                    required
                    error={errors.references}
                    className="sm:col-span-2"
                  >
                    <textarea
                      id="a-refs"
                      rows={3}
                      value={values.references}
                      onChange={(e) => set('references', e.target.value)}
                      placeholder={'1. Dana Lee — Clinical Supervisor — (954) 555-0110\n2. Sam Ortiz — Lead RBT — (954) 555-0187'}
                      className={cn(fieldBase, 'resize-y min-h-[88px]', errors.references && 'border-coral-bright')}
                    />
                  </Field>

                  {/* Résumé upload */}
                  <div className="sm:col-span-2">
                    <Label htmlFor="a-resume" required>
                      CV / résumé
                    </Label>
                    <input
                      id="a-resume"
                      ref={fileInputRef}
                      type="file"
                      accept={RESUME_TYPES.join(',')}
                      onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-left transition',
                        resume
                          ? 'border-teal-bright/60 bg-teal-bright/10'
                          : 'border-white/25 bg-white/[0.04] hover:border-teal-bright/50 hover:bg-white/[0.08]',
                        errors.resume && 'border-coral-bright',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                          resume ? 'bg-teal-bright/20 text-teal-bright' : 'bg-white/10 text-white/70',
                        )}
                      >
                        {resume ? <FileText size={18} /> : <Paperclip size={18} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-white">
                          {resume ? resume.name : 'Attach your CV / résumé'}
                        </span>
                        <span className="block text-xs text-white/60">
                          {resume
                            ? `${(resume.size / 1024 / 1024).toFixed(1)}MB — click to replace`
                            : `PDF, DOC, DOCX, RTF or TXT · up to ${MAX_RESUME_MB}MB`}
                        </span>
                      </span>
                    </button>
                    {errors.resume && (
                      <p className="mt-1 text-xs font-medium text-coral-bright">{errors.resume}</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
                  <p className="text-xs leading-relaxed text-text-light/60">
                    Your details are used only to consider you for employment.
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
                      'Submit application'
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

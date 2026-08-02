import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { site } from '@/content/site';
import { fieldBase, Label, PANEL_BLOOMS, PanelChrome, Select } from '@/lib/ui';
import {
  ApiError,
  getResumeUploadUrl,
  MIN_FORM_AGE_MS,
  postApplication,
  uploadToS3,
} from '@/lib/api';
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
  /** Sub-step of `sending`, so the button can name what is happening. */
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'sending'>('idle');
  /* Spam traps: a field no human sees, and the moment the form opened. */
  const [company, setCompany] = useState('');
  const formOpenedAt = useRef(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const set = (key: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  /* The role card that opened the dialog wins. The form keeps its values when
     closed without submitting, so this must OVERWRITE rather than only fill a
     blank — otherwise picking RBT, closing, then picking BCBA still says RBT. */
  useEffect(() => {
    if (!open || !presetPosition) return;
    setValues((v) => (v.position === presetPosition ? v : { ...v, position: presetPosition }));
    setErrors((e) => (e.position ? { ...e, position: undefined } : e));
  }, [open, presetPosition]);

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
      setCompany('');
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

    const subject = `Job application — ${values.position || 'Applicant'} — ${values.name.trim()}`;
    const mailFallback = () => {
      // Never a link: the résumé lives in a private bucket, so the fallback
      // email asks the applicant to send the file directly.
      window.location.href = `mailto:${site.contact.email}?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(asPlainText(values, '', resume?.name ?? ''))}`;
    };

    const spam = {
      company,
      formOpenedAt: formOpenedAt.current || Date.now() - MIN_FORM_AGE_MS,
    };

    /* Three steps, because a 5MB résumé base64s to ~6.9MB — past Lambda's 6MB
       synchronous payload ceiling. The file goes browser -> S3 direct.

       The upload gets its OWN try/catch. Wrapping all three steps together
       meant a rejected file name (or a flaky S3 PUT) skipped straight to the
       "thank you" screen with no record stored anywhere. */
    let uploadId: string | null = null;
    /* The server sanitises the filename and bakes it into the S3 key, so the
       application POST has to echo the server's version back verbatim. */
    let storedName: string | undefined;

    if (resume) {
      setPhase('uploading');
      try {
        const ticket = await getResumeUploadUrl({
          filename: resume.name,
          contentType: resume.type || 'application/octet-stream',
          size: resume.size,
          ...spam,
        });
        if (ticket.uploadId && ticket.url) {
          await uploadToS3(ticket, resume);
          uploadId = ticket.uploadId;
          storedName = ticket.filename ?? resume.name;
        }
      } catch (err) {
        // A 4xx from /upload-url means the FILE was refused (bad name, bad
        // extension, too large). Sending the application without it would lose
        // the résumé silently, so send the applicant back to the field.
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          setPhase('idle');
          setStatus('idle');
          setErrors((prev) => ({
            ...prev,
            resume:
              err.status === 413 || /5 MB|too large/i.test(err.message)
                ? err.message
                : 'We couldn’t accept that file name. Please rename your résumé using letters and numbers (for example resume.pdf) and attach it again.',
          }));
          window.setTimeout(() => {
            const bad = panelRef.current?.querySelector<HTMLElement>('.border-coral-bright');
            bad?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 0);
          return;
        }
        // Anything else (network blip, S3 PUT failure) — the application itself
        // is far more valuable than the attachment, so it still goes through
        // with resume:null. The orphaned incoming object, if any, is reaped by
        // the 7-day lifecycle rule.
        uploadId = null;
        storedName = undefined;
      }
    }

    try {
      setPhase('sending');
      await postApplication({
        values,
        ...(uploadId ? { uploadId, filename: storedName } : {}),
        ...spam,
      });
    } catch {
      // Reserved for a genuine failure to store the application.
      mailFallback();
    }

    setPhase('idle');
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

          <PanelChrome
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-title"
            className="w-full max-w-3xl my-auto"
            blooms={PANEL_BLOOMS.application}
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
                    <Select
                      id="a-position"
                      value={values.position}
                      onChange={(v) => set('position', v)}
                      invalid={!!errors.position}
                    >
                      <option value="">Select a position</option>
                      {POSITIONS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </Select>
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
                    <Select
                      id="a-rtw"
                      value={values.rightToWork}
                      onChange={(v) => set('rightToWork', v)}
                      invalid={!!errors.rightToWork}
                    >
                      <option value="">Select an answer</option>
                      <option>Yes</option>
                      <option>No</option>
                    </Select>
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
                        {phase === 'uploading' ? 'Uploading résumé…' : 'Sending…'}
                      </>
                    ) : (
                      'Submit application'
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

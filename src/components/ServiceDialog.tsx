import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Sparkles, X } from 'lucide-react';
import { site } from '@/content/site';
import { SERVICES } from '@/content/services';
import { GrainOverlay } from '@/components/primitives/AuroraField';
import { useServiceDialog } from '@/lib/dialogs';
import { usePrefersReducedMotion, easeOutExpo } from '@/lib/motion';

export default function ServiceDialog() {
  const { open, serviceId, closeDialog, openConsultation } = useServiceDialog();
  const reduced = usePrefersReducedMotion();

  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const service = SERVICES.find((s) => s.id === serviceId) ?? null;

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    const focusTimer = window.setTimeout(
      () => panelRef.current?.querySelector<HTMLElement>('button')?.focus(),
      120,
    );

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
        'a[href], button:not([disabled])',
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
      {open && service && (
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
            aria-labelledby="service-title"
            className="relative w-full max-w-2xl my-auto overflow-hidden rounded-3xl shadow-cosmic ring-1 ring-white/10"
            style={{ background: 'linear-gradient(180deg, #140A2E 0%, #1C0E3E 55%, #241348 100%)' }}
            {...panelMotion}
          >
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                background:
                  'radial-gradient(closest-side, rgba(47,224,216,0.30), transparent 70%) -15% -10% / 65% 55% no-repeat, radial-gradient(closest-side, rgba(255,111,176,0.26), transparent 70%) 112% -6% / 62% 52% no-repeat, radial-gradient(closest-side, rgba(255,196,77,0.20), transparent 70%) 50% 112% / 80% 45% no-repeat',
              }}
              aria-hidden="true"
            />
            <GrainOverlay opacity={0.06} />

            <div className="relative z-10 px-6 sm:px-9 pt-7 pb-4 text-center">
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
                className="mx-auto h-20 w-20 object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
              />

              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 ring-1 ring-white/15">
                <service.icon size={16} className="text-teal-bright" aria-hidden="true" />
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-bright">
                  Our services
                </span>
              </div>

              <h2
                id="service-title"
                className="mt-3 font-bold tracking-tight text-text-light"
                style={{ fontSize: 'clamp(24px, 3.6vw, 32px)' }}
              >
                {service.title}
              </h2>
              <p className="mt-2 text-sm text-gold-bright">{service.goodFor}</p>
            </div>

            <div className="relative z-10 px-6 sm:px-9 pb-8">
              <p className="text-[15px] leading-relaxed text-text-light/85">{service.intro}</p>

              <div className="mt-7 grid gap-7 sm:grid-cols-2">
                <div>
                  <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-magenta-bright">
                    <Sparkles size={14} aria-hidden="true" />
                    What a session looks like
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {service.sessions.map((line) => (
                      <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-text-light/85">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-magenta-bright"
                          aria-hidden="true"
                        />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-bright">
                    <Check size={14} aria-hidden="true" />
                    What&rsquo;s included
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {service.includes.map((line) => (
                      <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-text-light/85">
                        <Check
                          size={15}
                          className="mt-0.5 shrink-0 text-teal-bright"
                          aria-hidden="true"
                        />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
                <p className="text-sm text-text-light/70">
                  Covered by Aetna, Florida Blue, Cigna and Step Up For Students.
                </p>
                <button
                  type="button"
                  onClick={openConsultation}
                  className="inline-flex w-full items-center justify-center rounded-full bg-gold px-7 py-3.5 text-[15px] font-semibold text-ink transition hover:scale-[1.03] hover:shadow-glow-gold sm:w-auto"
                >
                  Schedule a consultation
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

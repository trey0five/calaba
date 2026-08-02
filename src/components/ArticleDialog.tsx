import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, X } from 'lucide-react';
import { site } from '@/content/site';
import { ARTICLES } from '@/content/articles';
import { PHOTOS } from '@/data/photos';
import { GrainOverlay } from '@/components/primitives/AuroraField';
import { useArticleDialog } from '@/lib/dialogs';
import { usePrefersReducedMotion, easeOutExpo } from '@/lib/motion';

export default function ArticleDialog() {
  const { open, articleId, closeDialog, openConsultation } = useArticleDialog();
  const reduced = usePrefersReducedMotion();

  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const index = ARTICLES.findIndex((a) => a.id === articleId);
  const article = index >= 0 ? ARTICLES[index] : null;
  const photo = index >= 0 ? PHOTOS.blog[index] : null;

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
      {open && article && (
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
            aria-labelledby="article-title"
            className="relative w-full max-w-2xl my-auto overflow-hidden rounded-3xl shadow-cosmic ring-1 ring-white/10"
            style={{ background: 'linear-gradient(180deg, #140A2E 0%, #1C0E3E 55%, #241348 100%)' }}
            {...panelMotion}
          >
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                background:
                  'radial-gradient(closest-side, rgba(47,224,216,0.28), transparent 70%) -15% 6% / 65% 55% no-repeat, radial-gradient(closest-side, rgba(255,111,176,0.24), transparent 70%) 112% 40% / 62% 52% no-repeat, radial-gradient(closest-side, rgba(255,196,77,0.20), transparent 70%) 50% 112% / 80% 45% no-repeat',
              }}
              aria-hidden="true"
            />
            <GrainOverlay opacity={0.06} />

            <button
              type="button"
              onClick={closeDialog}
              aria-label="Close"
              className="fixed sm:absolute right-4 top-4 z-30 grid h-11 w-11 place-items-center rounded-full bg-ink-950/70 text-white/80 ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15 hover:text-white"
            >
              <X size={18} />
            </button>

            {/* Cover image, faded into the panel */}
            {photo && (
              <div className="relative z-10 h-44 sm:h-56 overflow-hidden">
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="h-full w-full object-cover object-center"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, #140A2E 0%, rgba(20,10,46,0.85) 22%, rgba(20,10,46,0.45) 55%, rgba(20,10,46,0.15) 100%)',
                  }}
                  aria-hidden="true"
                />
              </div>
            )}

            <div className="relative z-10 -mt-12 px-6 sm:px-9 text-center">
              <img
                src={site.logo}
                alt="CAL-ABA"
                className="mx-auto h-16 w-16 object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
              />
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="rounded-full bg-teal-bright/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-bright ring-1 ring-teal-bright/30">
                  {article.tag}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-text-light/70">
                  <Clock size={13} aria-hidden="true" />
                  {article.readMinutes} min read
                </span>
              </div>
              <h2
                id="article-title"
                className="mt-3 font-bold tracking-tight text-text-light"
                style={{ fontSize: 'clamp(23px, 3.6vw, 31px)' }}
              >
                {article.title}
              </h2>
            </div>

            <div className="relative z-10 px-6 sm:px-9 pb-8 pt-5">
              <p className="text-[15px] leading-relaxed text-text-light/85">{article.intro}</p>

              {article.sections.map((section) => (
                <section key={section.heading} className="mt-7">
                  <h3 className="text-[15px] font-bold text-gold-bright">{section.heading}</h3>
                  {section.paragraphs?.map((p) => (
                    <p key={p} className="mt-2.5 text-[15px] leading-relaxed text-text-light/85">
                      {p}
                    </p>
                  ))}
                  {section.bullets && (
                    <ul className="mt-3 space-y-2.5">
                      {section.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex gap-2.5 text-[15px] leading-relaxed text-text-light/85"
                        >
                          <span
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-bright"
                            aria-hidden="true"
                          />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}

              <div className="mt-8 rounded-2xl border-l-[3px] border-gold bg-white/[0.06] px-5 py-4">
                <p className="text-[15px] font-medium leading-relaxed text-text-light">
                  {article.takeaway}
                </p>
              </div>

              <div className="mt-8 flex flex-col items-center gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
                <p className="text-sm text-text-light/70">Questions about your own situation?</p>
                <button
                  type="button"
                  onClick={openConsultation}
                  className="inline-flex w-full items-center justify-center rounded-full bg-gold px-7 py-3.5 text-[15px] font-semibold text-ink transition hover:scale-[1.03] hover:shadow-glow-gold sm:w-auto"
                >
                  Talk to our team
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

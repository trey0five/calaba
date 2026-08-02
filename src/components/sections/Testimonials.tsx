import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import { site } from '@/content/site';
import { getTestimonials, Testimonial } from '@/lib/api';
import { AVATAR_GRADIENTS } from '@/lib/ui';
import AuroraField, { SectionSeams } from '@/components/primitives/AuroraField';
import AuroraRibbon from '@/components/primitives/AuroraRibbon';
import ParticleField from '@/components/primitives/ParticleField';
import { useReview } from '@/lib/dialogs';
import { usePrefersReducedMotion, easeOutExpo } from '@/lib/motion';
import { cn } from '@/lib/cn';
import Reveal from '@/components/primitives/Reveal';

const ROTATE_MS = 9000;

export default function Testimonials() {
  const reduced = usePrefersReducedMotion();
  const { openDialog: openReview } = useReview();
  /* The bundled samples ARE the fallback: they render immediately and stay
     forever if the API is slow, down, or has nothing approved yet. */
  const [quotes, setQuotes] = useState<Testimonial[]>(site.testimonials);
  const [[index, direction], setSlide] = useState<[number, number]>([0, 1]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let live = true;
    const apply = (items: Awaited<ReturnType<typeof getTestimonials>>) => {
      if (!live || !items || items.length === 0) return;
      setQuotes(items);
      // The live set is a different length — restart the carousel rather than
      // landing on an index that no longer exists.
      setSlide([0, 1]);
    };
    getTestimonials(ac.signal, apply).then(apply);
    return () => {
      live = false;
      ac.abort();
    };
  }, []);

  const go = useCallback(
    (next: number, dir: number) => {
      setSlide([((next % quotes.length) + quotes.length) % quotes.length, dir]);
    },
    [quotes.length],
  );

  /* Autoplay — pauses on hover/focus and while a pointer is down. */
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (reduced || paused) return;
    timerRef.current = window.setTimeout(() => go(index + 1, 1), ROTATE_MS);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [index, paused, reduced, go]);

  const current = quotes[index];
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];

  const slide = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60, scale: 0.98 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60, scale: 0.98 }),
  };

  return (
    <section
      id="voices"
      className="relative bg-bg-deep text-text-light overflow-hidden py-14 sm:py-24 md:py-32"
    >
      <AuroraField variant="testimonials" seams={false} />
      <AuroraRibbon
        mode="echo"
        echoOpacity={0.18}
        className="absolute z-0 w-[min(130vw,2000px)] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      />
      <ParticleField density={70} seed={6} shootingStars />
      {/* Seams last so stars and ribbon melt into the light neighbours too */}
      <SectionSeams variant="testimonials" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10">
        <Reveal direction="up" className="text-center mx-auto max-w-3xl mb-12">
          <div className="flex flex-col items-center">
            <span className="text-teal-bright font-semibold text-xs tracking-[0.14em] uppercase">
              Family voices
            </span>
          </div>
          <h2
            className="mt-4 text-text-light font-bold tracking-tight leading-[1.1]"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
          >
            What families say
          </h2>
          <div className="mt-5 flex items-center justify-center gap-3">
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={17} className="fill-gold text-gold" />
              ))}
            </div>
            <span className="text-sm text-text-light/75">
              5.0 average from families we serve
            </span>
          </div>
        </Reveal>

        <Reveal direction="scale" className="relative max-w-4xl mx-auto">
          <div
            className="relative"
            onPointerDown={() => setPaused(true)}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            {/* Gradient hairline frame around the glass card */}
            <div
              className="pointer-events-none absolute -inset-px rounded-[26px] opacity-70"
              style={{
                background:
                  'linear-gradient(135deg, rgba(47,224,216,0.55), rgba(255,111,176,0.45) 45%, rgba(255,196,77,0.5))',
              }}
              aria-hidden="true"
            />

            <div className="relative rounded-[25px] bg-white/[0.06] backdrop-blur-sm px-6 py-10 sm:px-12 sm:py-12 shadow-cosmic">
              <Quote
                size={54}
                className="absolute left-6 top-6 hidden text-gold/25 sm:left-9 sm:block"
                aria-hidden="true"
              />

              <div className="min-h-[300px] sm:min-h-[260px] flex items-center">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.blockquote
                    key={index}
                    custom={direction}
                    variants={reduced ? undefined : slide}
                    initial={reduced ? false : 'enter'}
                    animate={reduced ? undefined : 'center'}
                    exit={reduced ? undefined : 'exit'}
                    transition={{ duration: 0.55, ease: easeOutExpo }}
                    drag={reduced ? false : 'x'}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.18}
                    onDragStart={() => setPaused(true)}
                    onDragEnd={(_, info) => {
                      setPaused(false);
                      if (info.offset.x < -60) go(index + 1, 1);
                      else if (info.offset.x > 60) go(index - 1, -1);
                    }}
                    className="w-full cursor-grab active:cursor-grabbing"
                  >
                    {/* role="img" — a bare <div> has no role for the accessible
                        name to attach to, so the rating announced as nothing. */}
                    <div
                      className="flex gap-1 mb-4"
                      role="img"
                      aria-label={`${current.rating} out of 5 stars`}
                    >
                      {Array.from({ length: current.rating }, (_, i) => (
                        <Star key={i} size={16} className="fill-gold text-gold" aria-hidden="true" />
                      ))}
                    </div>

                    <p
                      className="text-text-light leading-relaxed"
                      style={{ fontSize: 'clamp(17px, 2.2vw, 21px)' }}
                    >
                      {current.quote}
                    </p>

                    <footer className="mt-7 flex flex-wrap items-center gap-4">
                      <span
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[15px] font-bold text-white ring-1 ring-white/20"
                        style={{ background: gradient }}
                        aria-hidden="true"
                      >
                        {current.initials}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-text-light">{current.attribution}</div>
                        <div className="text-sm text-text-light/70">{current.location}</div>
                      </div>
                      <span className="sm:ml-auto rounded-full bg-teal-bright/15 px-3.5 py-1.5 text-xs font-semibold text-teal-bright ring-1 ring-teal-bright/30">
                        {current.service}
                      </span>
                    </footer>
                  </motion.blockquote>
                </AnimatePresence>
              </div>
            </div>

            {/* Arrows sit outside the card on desktop, below it on mobile */}
            <button
              type="button"
              onClick={() => go(index - 1, -1)}
              className="absolute -left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink-950/70 text-text-light ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15 sm:grid lg:-left-6"
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1, 1)}
              className="absolute -right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink-950/70 text-text-light ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15 sm:grid lg:-right-6"
              aria-label="Next testimonial"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Progress bars double as the pager and the autoplay timer */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => go(index - 1, -1)}
              className="grid h-11 w-11 place-items-center rounded-full text-text-light ring-1 ring-white/20 transition hover:bg-white/10 sm:hidden"
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={18} />
            </button>

            {quotes.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i, i > index ? 1 : -1)}
                aria-label={`Show testimonial ${i + 1}`}
                aria-current={i === index}
                className="group relative h-1.5 rounded-full bg-white/20 transition-all before:absolute before:inset-x-0 before:-inset-y-5 before:content-['']"
                style={{ width: i === index ? 44 : 18 }}
              >
                {i === index && (
                  <motion.span
                    key={`${index}-${paused}`}
                    className="absolute inset-y-0 left-0 rounded-full bg-gold"
                    initial={{ width: reduced ? '100%' : 0 }}
                    animate={{ width: '100%' }}
                    transition={{
                      duration: reduced || paused ? 0 : ROTATE_MS / 1000,
                      ease: 'linear',
                    }}
                  />
                )}
                <span
                  className={cn(
                    'absolute inset-0 rounded-full transition-colors',
                    i !== index && 'group-hover:bg-white/40',
                  )}
                />
              </button>
            ))}

            <button
              type="button"
              onClick={() => go(index + 1, 1)}
              className="grid h-11 w-11 place-items-center rounded-full text-text-light ring-1 ring-white/20 transition hover:bg-white/10 sm:hidden"
              aria-label="Next testimonial"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-text-light/70">
              Has CAL-ABA worked with your family?
            </p>
            <button
              type="button"
              onClick={openReview}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-7 py-3.5 text-[15px] font-semibold text-text-light ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20 hover:scale-[1.03]"
            >
              <Star size={17} className="fill-gold text-gold" aria-hidden="true" />
              Leave a review
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

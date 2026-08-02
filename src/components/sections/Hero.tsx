import { useRef } from 'react';
import { motion, useScroll, useTransform, type Variants } from 'framer-motion';
import {
  ClipboardCheck,
  HeartHandshake,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import Reveal from '@/components/primitives/Reveal';
import AuroraField, {
  AURORA_CORAL,
  AURORA_GOLD,
  AURORA_MAGENTA,
  AURORA_TEAL,
  GrainOverlay,
  bloomStyle,
} from '@/components/primitives/AuroraField';
import AuroraRibbon from '@/components/primitives/AuroraRibbon';
import ParticleField from '@/components/primitives/ParticleField';
import { useConsultation } from '@/lib/dialogs';
import { usePrefersReducedMotion } from '@/lib/motion';

const stats: {
  icon: LucideIcon;
  word: string;
  label: string;
  gradient: string;
  glow: string;
}[] = [
  {
    icon: ClipboardCheck,
    word: 'BCBA-led',
    label: 'Every treatment plan',
    gradient: 'linear-gradient(135deg, #2FE0D8 0%, #0E5A56 100%)',
    glow: 'rgba(47,224,216,0.35)',
  },
  {
    icon: HeartHandshake,
    word: 'Assent-based',
    label: 'Care your child agrees to',
    gradient: 'linear-gradient(135deg, #FF6FB0 0%, #9C1F5B 100%)',
    glow: 'rgba(255,111,176,0.32)',
  },
  {
    icon: ShieldCheck,
    word: 'In-network',
    label: 'Aetna · Florida Blue · Cigna · Step Up',
    gradient: 'linear-gradient(135deg, #FFC44D 0%, #B8451F 100%)',
    glow: 'rgba(255,196,77,0.35)',
  },
];

const easeOut = [0.16, 1, 0.3, 1] as const;

const ctaGroup: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 1.15 } },
};
const ctaItem: Variants = {
  hidden: { y: 24, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.6, ease: easeOut } },
};

const statGroup: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 1.45 } },
};
const statItem: Variants = {
  hidden: { y: 36, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.7, ease: easeOut } },
};

export default function Hero() {
  const reduced = usePrefersReducedMotion();
  const { openDialog } = useConsultation();
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll-driven parallax — each layer translates at a different rate
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const bgDeep = useTransform(scrollYProgress, [0, 1], ['0%', '40%']);
  const bgMid = useTransform(scrollYProgress, [0, 1], ['0%', '22%']);

  return (
    <section
      id="top"
      ref={sectionRef}
      className="relative overflow-hidden min-h-[700px] sm:min-h-[720px] md:min-h-[760px]"
    >
      {/* Night field: deep-ink vertical gradient */}
      <AuroraField variant="hero" />

      {/* Deepest bloom layer: pre-faded radial auroras (no filter blur) */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        style={reduced ? undefined : { y: bgDeep }}
        aria-hidden="true"
      >
        <div
          className="animate-aurora-1"
          style={{
            ...bloomStyle(AURORA_TEAL, 0.55, 'max(48vw, 420px)', { left: '-8%', top: '6%' }),
            willChange: 'transform',
          }}
        />
        <div
          className="animate-aurora-3"
          style={{
            ...bloomStyle(AURORA_GOLD, 0.45, 'max(40vw, 360px)', { left: '32%', bottom: '-20%' }),
            willChange: 'transform',
          }}
        />
      </motion.div>

      {/* Mid bloom layer */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        style={reduced ? undefined : { y: bgMid }}
        aria-hidden="true"
      >
        <div
          className="animate-aurora-2"
          style={{
            ...bloomStyle(AURORA_MAGENTA, 0.5, 'max(52vw, 460px)', { right: '-10%', top: '12%' }),
            willChange: 'transform',
          }}
        />
        <div
          className="animate-aurora-4"
          style={{
            ...bloomStyle(AURORA_CORAL, 0.4, 'max(26vw, 240px)', { left: '8%', bottom: '10%' }),
            willChange: 'transform',
          }}
        />
      </motion.div>

      {/* Giant infinity ribbon: blurred glow pass + crisp echo stroke */}
      <AuroraRibbon
        mode="full"
        blurOpacity={0.35}
        echoOpacity={0.22}
        drawOn
        className="absolute z-0 w-[min(150vw,2200px)] left-1/2 -translate-x-1/2 top-[2%] rotate-[-6deg]"
      />


      {/* Melt decorations into the CredentialsBand seam, grain on top.
          Multi-stop easing curve instead of a linear alpha ramp — a linear
          fade over this distance shows Mach banding and reads as stepping. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-56"
        style={{
          background:
            'linear-gradient(to top, #241348 0%, rgba(36,19,72,0.98) 10%, rgba(36,19,72,0.92) 22%, rgba(36,19,72,0.78) 35%, rgba(36,19,72,0.58) 48%, rgba(36,19,72,0.36) 62%, rgba(36,19,72,0.18) 76%, rgba(36,19,72,0.06) 88%, rgba(36,19,72,0) 100%)',
        }}
        aria-hidden="true"
      />
      <GrainOverlay opacity={0.06} />

      {/* Readability scrim: pools darkness under the copy without dimming the
          whole field, so the headline holds up over the brightest blooms. */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(130% 95% at 26% 44%, rgba(10,4,26,0.62) 0%, rgba(10,4,26,0.34) 42%, rgba(10,4,26,0.08) 68%, transparent 82%)',
        }}
        aria-hidden="true"
      />

      {/* Canvas last: mix-blend-mode layers ABOVE a repainting canvas force a
          full re-composite every frame, which flickers. */}
      <ParticleField density={110} seed={2} shootingStars />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-8 pb-10 sm:pt-16 sm:pb-16 md:pt-24">
        <div className="relative max-w-4xl">
          <div className="relative z-10">
            <Reveal direction="up" delay={0.25}>
              <span className="inline-flex flex-col">
                <span className="type-lift-soft text-teal-bright font-bold text-[11px] sm:text-sm tracking-[0.14em] sm:tracking-[0.2em] uppercase">
                  Compassionate, evidence-based ABA
                </span>
                <Reveal
                  direction="scale"
                  delay={0.45}
                  className="mt-2 h-[2px] w-16 bg-gradient-to-r from-gold to-coral rounded-full origin-left"
                  aria-hidden
                >
                  <span className="block w-full h-full" />
                </Reveal>
              </span>
            </Reveal>

            <h1
              className="type-lift mt-6 font-bold tracking-tight leading-[1.03] text-white"
              style={{ fontSize: 'clamp(34px, 9vw, 76px)' }}
            >
              <Reveal as="span" direction="up" delay={0.4} className="block">
                Children are{' '}
                {reduced ? (
                  <span className="brand-gradient-text-bright word-glow">limitless</span>
                ) : (
                  <motion.span
                    className="brand-gradient-text-bright word-glow inline-block"
                    initial={{ scale: 0, rotate: -10, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 220,
                      damping: 12,
                      delay: 0.85,
                    }}
                    style={{ transformOrigin: 'center' }}
                  >
                    limitless
                  </motion.span>
                )}{' '}
                —
              </Reveal>
              <Reveal as="span" direction="up" delay={0.65} className="block">
                and so is our commitment to them.
              </Reveal>
            </h1>

            <Reveal direction="up" delay={0.85}>
              <p className="type-lift-soft mt-6 text-text-light/95 text-[17px] sm:text-lg leading-[1.7] max-w-xl">
                Home, school, and community-based ABA therapy that centers your child's
                voice, your family's goals, and the dignity of every learner.
              </p>
            </Reveal>

            <motion.div
              className="mt-8 flex flex-wrap gap-3 sm:gap-4"
              variants={ctaGroup}
              initial={reduced ? false : 'hidden'}
              animate={reduced ? false : 'show'}
            >
              <motion.button
                type="button"
                onClick={openDialog}
                variants={ctaItem}
                className="animate-gold-pulse inline-flex items-center bg-gold text-ink px-7 sm:px-8 py-3.5 sm:py-4 rounded-full font-semibold text-[15px] hover:scale-[1.04] hover:shadow-glow-gold transition-transform"
              >
                Schedule a consultation
              </motion.button>
              <motion.a
                href="#aba"
                variants={ctaItem}
                className="inline-flex items-center ring-2 ring-teal-bright text-teal-bright bg-white/5 px-7 sm:px-8 py-3.5 sm:py-4 rounded-full font-semibold text-[15px] hover:bg-teal-bright/15 hover:scale-[1.02] transition"
              >
                Learn about ABA
              </motion.a>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pb-12 sm:pb-20 -mt-4"
        variants={statGroup}
        initial={reduced ? false : 'hidden'}
        animate={reduced ? false : 'show'}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((s) => (
            <motion.div
              key={s.word}
              variants={statItem}
              style={{ ['--glow' as string]: s.glow, ['--grad' as string]: s.gradient }}
              className="group relative rounded-2xl p-px shadow-cosmic transition-shadow duration-500 hover:shadow-[0_24px_54px_-20px_var(--glow)]"
            >
              {/* accent hairline frame, resolves on hover */}
              <span
                className="pointer-events-none absolute inset-0 rounded-2xl bg-white/15 transition-opacity duration-500"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: 'var(--grad)' }}
                aria-hidden="true"
              />

              <div className="relative flex items-center gap-3.5 rounded-[15px] bg-ink-950/70 px-4 py-4 backdrop-blur-md">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-[0_10px_22px_-8px_var(--glow)] transition-transform duration-500 group-hover:scale-105"
                  style={{ background: 'var(--grad)' }}
                >
                  <s.icon size={21} />
                </span>
                <span className="min-w-0">
                  <span className="type-lift-soft block text-white font-bold text-[17px] leading-tight">
                    {s.word}
                  </span>
                  <span className="mt-0.5 block text-text-light/80 text-[13px] leading-snug">
                    {s.label}
                  </span>
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

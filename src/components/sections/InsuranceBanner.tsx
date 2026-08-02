import { useState } from 'react';
import Reveal from '@/components/primitives/Reveal';
import AuroraField from '@/components/primitives/AuroraField';
import { usePrefersReducedMotion } from '@/lib/motion';

type Insurer = {
  slug: string;
  name: string;
  /** brand-tint used only for the typographic fallback accent */
  tint: string;
};

const INSURERS: Insurer[] = [
  { slug: 'aetna', name: 'Aetna', tint: '#8E2DA8' },
  { slug: 'florida-blue', name: 'Florida Blue', tint: '#0067B1' },
  { slug: 'cigna', name: 'Cigna', tint: '#00A9CE' },
  { slug: 'stepup', name: 'Step Up For Students', tint: '#5BA630' },
];

function InsurerCard({ insurer }: { insurer: Insurer }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = `${import.meta.env.BASE_URL}insurance/${insurer.slug}.png`;

  return (
    <div className="shrink-0 mx-2 sm:mx-4">
      <div className="group h-24 w-44 sm:h-28 sm:w-64 overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hair transition-transform duration-300 hover:scale-[1.03]">
        {imgFailed ? (
          <span
            className="flex h-full w-full items-center justify-center px-6 text-center text-lg font-extrabold leading-tight tracking-tight"
            style={{ color: insurer.tint }}
          >
            {insurer.name}
          </span>
        ) : (
          <img
            src={src}
            alt={`${insurer.name} insurance accepted`}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}

export default function InsuranceBanner() {
  const reduced = usePrefersReducedMotion();
  // one visual group = the set repeated enough to fill wide viewports
  const group = [...INSURERS, ...INSURERS, ...INSURERS];

  return (
    <section
      id="insurance"
      className="relative py-20 sm:py-24 md:py-28 overflow-hidden overflow-x-clip"
    >
      <AuroraField variant="insurance" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
        <Reveal direction="up" className="mx-auto max-w-3xl text-center">
          <span className="text-teal-deep text-xs font-semibold uppercase tracking-[0.14em]">
            Affordable, Covered Care
          </span>
          <h2
            className="mt-4 font-bold leading-[1.1] tracking-tight text-text-base"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
          >
            Insurance we <span className="brand-gradient-text">accept</span>
          </h2>
          <p className="mt-4 text-base leading-[1.7] text-text-base/85 md:text-lg">
            We make starting care simple. CAL-ABA is in-network with the plans
            families ask about most — and we'll help you verify your benefits.
          </p>
        </Reveal>
      </div>

      {/* Dynamic marquee belt */}
      <Reveal direction="scale" scale={0.95} delay={0.1} className="relative z-10 mt-14">
        <div className="relative">
          {/* edge fades */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-20 w-10 sm:w-24 bg-gradient-to-r from-bg-base to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 sm:w-24 bg-gradient-to-l from-bg-base to-transparent"
            aria-hidden="true"
          />

          {reduced ? (
            <div className="flex flex-wrap items-center justify-center gap-4 px-6">
              {INSURERS.map((ins) => (
                <InsurerCard key={ins.slug} insurer={ins} />
              ))}
            </div>
          ) : (
            <div className="flex w-max animate-marquee [animation-duration:26s] hover:[animation-play-state:paused]">
              {[...group, ...group].map((ins, i) => (
                <InsurerCard key={`${ins.slug}-${i}`} insurer={ins} />
              ))}
            </div>
          )}
        </div>
      </Reveal>

      <p className="relative z-10 mx-auto mt-12 max-w-2xl px-6 text-center text-sm text-text-muted">
        Don't see your plan? Reach out — we routinely help families confirm
        coverage and explore options.
      </p>
    </section>
  );
}

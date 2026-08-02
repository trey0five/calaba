import { useEffect, useState } from 'react';
import Reveal from '@/components/primitives/Reveal';
import AuroraField, { SectionSeams } from '@/components/primitives/AuroraField';
import ParticleField from '@/components/primitives/ParticleField';
import { getStaff } from '@/lib/api';
import { useConsultation } from '@/lib/dialogs';

/** Bundled fallback — never removed, so the section renders with the API down. */
const FALLBACK = {
  src: `${import.meta.env.BASE_URL}cristina-andrade.webp`,
  w: 900,
  h: 600,
  name: 'Cristina Andrade',
  title: 'Founder & Clinical Director',
  credentials: ['Ed.S.', 'BCBA'],
};

export default function Founder() {
  const [imgFailed, setImgFailed] = useState(false);
  const [founder, setFounder] = useState(FALLBACK);
  const { openDialog } = useConsultation();

  useEffect(() => {
    const ac = new AbortController();
    let live = true;
    const apply = (staff: Awaited<ReturnType<typeof getStaff>>) => {
      const f = staff?.founder;
      if (!live || !f || !f.photo?.url) return;
      setImgFailed(false);
      setFounder({
        // API photos are absolute S3 URLs — BASE_URL must NOT be prefixed
        src: f.photo.url,
        w: f.photo.w ?? FALLBACK.w,
        h: f.photo.h ?? FALLBACK.h,
        name: f.name || FALLBACK.name,
        title: f.title || FALLBACK.title,
        credentials: f.credentials?.length ? f.credentials : FALLBACK.credentials,
      });
    };
    getStaff(ac.signal, apply).then(apply);
    return () => {
      live = false;
      ac.abort();
    };
  }, []);

  const chips = founder.credentials;
  const credentialSuffix = chips.length ? `, ${chips.join(', ')}` : '';
  const [firstName, ...restName] = founder.name.split(' ');

  return (
    <section
      id="founder"
      className="relative py-14 sm:py-24 md:py-32 overflow-hidden overflow-x-clip"
    >
      <AuroraField variant="founder" seams={false} />
      <ParticleField density={65} seed={4} />
      {/* Seams last so particles melt into the paper sections above and below */}
      <SectionSeams variant="founder" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
        <Reveal direction="scale" scale={0.9} className="relative flex items-center justify-center">
          {/* Halo lifts the portrait off the night field */}
          <div
            className="pointer-events-none absolute -inset-6 sm:-inset-10"
            style={{
              background:
                'radial-gradient(closest-side, rgba(255,111,176,0.35), transparent 72%)',
            }}
            aria-hidden="true"
          />

          {imgFailed ? (
            <div className="relative w-full rounded-3xl aspect-[3/2] flex flex-col items-center justify-center text-center px-6 bg-ink-950 ring-1 ring-white/15">
              <img
                src={`${import.meta.env.BASE_URL}calaba2.png`}
                alt="CAL-ABA"
                className="h-16 w-auto opacity-90"
              />
              <p className="mt-5 text-text-light font-semibold text-lg">
                {founder.name}
                {credentialSuffix}
              </p>
              <p className="mt-1 text-gold-bright text-sm font-medium">{founder.title}</p>
            </div>
          ) : (
            <div
              className="relative rounded-[26px] p-[2px] shadow-[0_36px_90px_-24px_rgba(214,51,122,0.7)] transition-transform duration-500 hover:scale-[1.02]"
              style={{
                background:
                  'linear-gradient(135deg, #2FE0D8 0%, #FF6FB0 45%, #FFC44D 100%)',
              }}
            >
              <img
                src={founder.src}
                alt={`${founder.name}, ${founder.title} of CAL-ABA`}
                width={founder.w}
                height={founder.h}
                loading="lazy"
                decoding="async"
                onError={() => setImgFailed(true)}
                className="w-full rounded-3xl object-contain"
              />
            </div>
          )}
        </Reveal>

        <Reveal direction="up" delay={0.1}>
          <span className="text-teal-bright font-semibold text-xs tracking-[0.14em] uppercase">
            Meet the Founder
          </span>
          <h2
            className="mt-4 text-text-light font-bold tracking-tight leading-[1.1]"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
          >
            {firstName}{' '}
            <span className="brand-gradient-text-bright">{restName.join(' ')}</span>
            {credentialSuffix}
          </h2>
          <p className="mt-2 text-gold-bright font-semibold">{founder.title}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {chips.map((chip, i) => (
              <Reveal
                key={chip}
                direction="up"
                delay={0.15 + i * 0.15}
                as="span"
                className="inline-block bg-white/10 text-teal-bright ring-1 ring-teal-bright/35 rounded-full px-3 py-1 text-sm backdrop-blur-sm"
              >
                {chip}
              </Reveal>
            ))}
          </div>

          {/* PLACEHOLDER copy — replace with approved bio */}
          <p className="mt-6 text-text-light/85 text-base md:text-lg leading-[1.75] max-w-2xl">
            Cristina founded CAL-ABA to bring assent-based, family-centered ABA to Florida
            families who deserve more than a script. With graduate training in education and
            board certification in behavior analysis, she leads every clinical plan personally.
          </p>

          {/* PLACEHOLDER pull-quote — replace with approved quote */}
          <blockquote className="mt-6 border-l-4 border-gold pl-4 text-text-light/80 italic">
            "I wanted a practice where the child's 'yes' comes first."
          </blockquote>

          <button
            type="button"
            onClick={openDialog}
            className="inline-flex items-center bg-gold text-ink px-8 py-4 mt-8 rounded-full font-semibold text-[15px] hover:shadow-glow-gold hover:scale-[1.02] transition"
          >
            Schedule with our team
          </button>
        </Reveal>
      </div>
    </section>
  );
}

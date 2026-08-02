import { ArrowRight } from 'lucide-react';
import SectionShell from '@/components/primitives/SectionShell';
import Reveal, { RevealDirection } from '@/components/primitives/Reveal';
import PhotoFrame from '@/components/primitives/PhotoFrame';
import AuroraField from '@/components/primitives/AuroraField';
import AuroraRibbon from '@/components/primitives/AuroraRibbon';
import { PHOTOS } from '@/data/photos';
import { SERVICES } from '@/content/services';
import { cn } from '@/lib/cn';
import { useServiceDialog } from '@/lib/dialogs';

// Decorative accent (icon + top bar) rotates the full brand palette.
// Link text stays on a text-safe color for AA on the near-white card
// (coral/magenta fail 4.5:1 on white, so links use teal-deep).
const accents = [
  {
    icon: 'text-teal-deep',
    bar: 'bg-teal',
    title: 'group-hover:text-teal-deep',
    halo: 'group-hover:bg-teal/15 group-hover:ring-teal/40',
    ring: 'group-hover:ring-teal/50 group-focus-within:ring-teal/50',
    glow: 'rgba(34,199,192,0.45)',
  },
  {
    icon: 'text-gold-deep',
    bar: 'bg-gold',
    title: 'group-hover:text-gold-deep',
    halo: 'group-hover:bg-gold/15 group-hover:ring-gold/40',
    ring: 'group-hover:ring-gold/50 group-focus-within:ring-gold/50',
    glow: 'rgba(245,176,39,0.45)',
  },
  {
    icon: 'text-coral-deep',
    bar: 'bg-coral',
    title: 'group-hover:text-coral-deep',
    halo: 'group-hover:bg-coral/15 group-hover:ring-coral/40',
    ring: 'group-hover:ring-coral/50 group-focus-within:ring-coral/50',
    glow: 'rgba(238,75,60,0.42)',
  },
  {
    icon: 'text-magenta-deep',
    bar: 'bg-magenta',
    title: 'group-hover:text-magenta-deep',
    halo: 'group-hover:bg-magenta/15 group-hover:ring-magenta/40',
    ring: 'group-hover:ring-magenta/50 group-focus-within:ring-magenta/50',
    glow: 'rgba(214,51,122,0.42)',
  },
];

const directions: RevealDirection[] = ['left', 'up', 'right', 'left', 'up', 'right'];
const delays = [0, 0.08, 0.16, 0.24, 0.32, 0.4];

export default function Services() {
  const { openService } = useServiceDialog();

  return (
    <div id="services" className="relative overflow-hidden overflow-x-clip">
      <AuroraField variant="services" />
      <AuroraRibbon
        mode="blur"
        blurOpacity={0.12}
        className="absolute z-0 w-[min(120vw,1900px)] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      />
      <SectionShell className="bg-transparent">
        <Reveal direction="up" className="mb-12">
          <span className="text-teal-deep font-semibold text-xs tracking-[0.14em] uppercase">
            What we offer
          </span>
          <h2
            className="mt-4 text-text-base font-bold tracking-tight leading-[1.1]"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
          >
            Services across home, school, and life
          </h2>
        </Reveal>
        <div
          data-auto-carousel
          className="flex items-stretch overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 -mx-6 px-6 pt-2 pb-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:overflow-visible md:mx-0 md:px-0 md:pb-0 md:items-stretch"
        >
          {SERVICES.map((s, i) => {
            const photo = PHOTOS.services[i];
            const a = accents[i % accents.length];
            return (
              <Reveal
                key={s.title}
                direction={directions[i]}
                delay={delays[i]}
                style={{ ['--glow' as string]: a.glow }}
                className={cn(
                  'snap-center shrink-0 w-[80vw] md:w-auto md:shrink relative self-stretch flex flex-col',
                  'bg-surface text-ink rounded-2xl ring-1 ring-hair shadow-card overflow-hidden group cursor-pointer',
                  'transition-[transform,box-shadow,--tw-ring-color] duration-500 ease-out',
                  'hover:-translate-y-2 hover:shadow-[0_30px_60px_-22px_var(--glow)]',
                  'focus-within:-translate-y-2 focus-within:shadow-[0_30px_60px_-22px_var(--glow)]',
                  a.ring,
                )}
              >
                <div
                  className={cn(
                    'h-1 w-full origin-left transition-transform duration-500 group-hover:scale-y-[3]',
                    a.bar,
                  )}
                  aria-hidden="true"
                />

                {/* sheen sweeps across on hover */}
                <span
                  className="pointer-events-none absolute inset-0 z-20 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-full"
                  aria-hidden="true"
                />

                {photo && (
                  <div className="p-4 pb-0">
                    <PhotoFrame innerClassName="h-40">
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        width={photo.width}
                        height={photo.height}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.12]"
                      />
                    </PhotoFrame>
                  </div>
                )}
                <div className="flex flex-col flex-1 p-8">
                  <span
                    className={cn(
                      'grid h-12 w-12 place-items-center rounded-2xl bg-surface-tint ring-1 ring-hair transition-all duration-500 group-hover:-rotate-6 group-hover:scale-110',
                      a.halo,
                    )}
                  >
                    <s.icon size={26} className={a.icon} />
                  </span>
                  <h3
                    className={cn('font-semibold text-ink mt-4 transition-colors duration-300', a.title)}
                    style={{ fontSize: '22px' }}
                  >
                    {s.title}
                  </h3>
                  <p className="text-sm text-ink-muted leading-relaxed mt-2">{s.body}</p>
                  {/* the button's ::after stretches over the whole card, so any
                      part of the tile opens the dialog while the link keeps its
                      accessible name and keyboard focus */}
                  <button
                    type="button"
                    onClick={() => openService(s.id)}
                    aria-label={`Learn more about ${s.title}`}
                    className="inline-flex items-center gap-1 text-teal-deep font-semibold mt-auto pt-4 pb-1 text-sm self-start outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
                  >
                    Learn more
                    <ArrowRight
                      size={16}
                      className="transition-transform duration-300 group-hover:translate-x-1.5"
                    />
                  </button>
                </div>
              </Reveal>
            );
          })}
        </div>
      </SectionShell>
    </div>
  );
}

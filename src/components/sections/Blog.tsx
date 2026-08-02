import { ArrowRight } from 'lucide-react';
import SectionShell from '@/components/primitives/SectionShell';
import Reveal, { RevealDirection } from '@/components/primitives/Reveal';
import PhotoFrame from '@/components/primitives/PhotoFrame';
import { PHOTOS } from '@/data/photos';
import { ARTICLES } from '@/content/articles';
import { useArticleDialog } from '@/lib/dialogs';
import { cn } from '@/lib/cn';

const cardDirections: RevealDirection[] = ['left', 'up', 'right'];
const cardDelays = [0, 0.08, 0.16];

// Decorative top-bar palette rotates the bright brand colors.
const bars = ['bg-teal', 'bg-gold', 'bg-coral', 'bg-magenta'];
const accents = [
  { ring: 'group-hover:ring-teal/50 group-focus-within:ring-teal/50', title: 'group-hover:text-teal-deep', glow: 'rgba(34,199,192,0.45)' },
  { ring: 'group-hover:ring-gold/50 group-focus-within:ring-gold/50', title: 'group-hover:text-gold-deep', glow: 'rgba(245,176,39,0.45)' },
  { ring: 'group-hover:ring-coral/50 group-focus-within:ring-coral/50', title: 'group-hover:text-coral-deep', glow: 'rgba(238,75,60,0.42)' },
  { ring: 'group-hover:ring-magenta/50 group-focus-within:ring-magenta/50', title: 'group-hover:text-magenta-deep', glow: 'rgba(214,51,122,0.42)' },
];

export default function Blog() {
  const { openArticle } = useArticleDialog();

  return (
    <SectionShell id="blog" field="blog" className="overflow-x-clip">
      <Reveal direction="up" className="mb-12">
        <span className="text-teal-deep font-semibold text-xs tracking-[0.14em] uppercase">
          Resources
        </span>
        <h2
          className="mt-4 text-text-base font-bold tracking-tight leading-[1.1]"
          style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
        >
          Learning together
        </h2>
      </Reveal>
      <div
        data-auto-carousel
        className="relative z-10 flex items-stretch overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 -mx-6 px-6 pt-2 pb-4 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:mx-0 md:px-0 md:pb-0 md:items-stretch"
      >
        {ARTICLES.map((a, i) => {
          const photo = PHOTOS.blog[i];
          const ac = accents[i % accents.length];
          return (
            <Reveal
              key={a.title}
              direction={cardDirections[i]}
              delay={cardDelays[i]}
              style={{ ['--glow' as string]: ac.glow }}
              className={cn(
                'snap-center shrink-0 w-[80vw] md:w-auto md:shrink relative self-stretch flex flex-col',
                'bg-surface text-ink rounded-2xl ring-1 ring-hair shadow-card overflow-hidden group cursor-pointer',
                'transition-[transform,box-shadow,--tw-ring-color] duration-500 ease-out',
                'hover:-translate-y-2 hover:shadow-[0_30px_60px_-22px_var(--glow)]',
                'focus-within:-translate-y-2 focus-within:shadow-[0_30px_60px_-22px_var(--glow)]',
                ac.ring,
              )}
            >
              <div
                className={cn(
                  'h-1 w-full origin-left transition-transform duration-500 group-hover:scale-y-[3]',
                  bars[i % bars.length],
                )}
                aria-hidden="true"
              />
              <span
                className="pointer-events-none absolute inset-0 z-20 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-full"
                aria-hidden="true"
              />
              <div className="p-4 pb-0">
                <PhotoFrame innerClassName="aspect-[16/9]">
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
              <div className="flex flex-col flex-1 p-6">
                <span className="text-teal-deep uppercase tracking-wider text-xs font-semibold">
                  {a.tag}
                </span>
                <h3
                  className={cn('text-ink font-semibold mt-2 transition-colors duration-300', ac.title)}
                  style={{ fontSize: '20px' }}
                >
                  {a.title}
                </h3>
                <p className="text-ink-muted text-sm mt-2 leading-relaxed line-clamp-2">
                  {a.excerpt}
                </p>
                <button
                  type="button"
                  onClick={() => openArticle(a.id)}
                  aria-label={`Read more: ${a.title}`}
                  className="inline-flex items-center gap-1 text-teal-deep font-semibold mt-auto pt-4 pb-1 text-sm self-start outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
                >
                  Read more
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-300 group-hover:translate-x-1.5"
                  />
                </button>
                <div className="text-ink-muted text-xs mt-2">{a.readMinutes} min read</div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </SectionShell>
  );
}

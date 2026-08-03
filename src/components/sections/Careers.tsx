import { useEffect, useState } from 'react';
import {
  ArrowRight,
  GraduationCap,
  HeartHandshake,
  MapPin,
  Quote,
  Star,
  TrendingUp,
  Users,
  LucideIcon,
} from 'lucide-react';
import Reveal from '@/components/primitives/Reveal';
import RevealGroup from '@/components/primitives/RevealGroup';
import AuroraField, { SectionSeams } from '@/components/primitives/AuroraField';
import ParticleField from '@/components/primitives/ParticleField';
import { getTeamReviews, TeamReview } from '@/lib/api';
import { useApplication, useTeamReview } from '@/lib/dialogs';

const roles: {
  title: string;
  tagline: string;
  blurb: string;
  gradient: string;
  accent: string;
}[] = [
  {
    title: 'RBT',
    tagline: 'Registered Behavior Technician',
    blurb:
      'Deliver daily 1:1 therapy in homes, schools and the community — never without a BCBA beside you.',
    gradient: 'linear-gradient(135deg, #2FE0D8 0%, #0E5A56 100%)',
    accent: 'text-teal-bright',
  },
  {
    title: 'BCaBA',
    tagline: 'Assistant Behavior Analyst',
    blurb:
      'Run programs and mentor RBTs while you complete supervision toward full certification.',
    gradient: 'linear-gradient(135deg, #FF6FB0 0%, #9C1F5B 100%)',
    accent: 'text-magenta-bright',
  },
  {
    title: 'BCBA',
    tagline: 'Board Certified Behavior Analyst',
    blurb:
      'Own assessment, treatment design and family training across a caseload that stays manageable.',
    gradient: 'linear-gradient(135deg, #FFC44D 0%, #B07C0F 100%)',
    accent: 'text-gold-bright',
  },
];

const perks: { icon: LucideIcon; title: string; body: string; accent: string }[] = [
  {
    icon: GraduationCap,
    title: 'Supervision hours, in house',
    body: 'Student analyst supervision toward BCBA and BCaBA certification — no chasing it elsewhere.',
    accent: 'text-teal-bright',
  },
  {
    icon: HeartHandshake,
    title: 'Assent-based practice',
    body: 'Neurodiversity-affirming care you can feel proud of. Dignity is non-negotiable here.',
    accent: 'text-coral-bright',
  },
  {
    icon: TrendingUp,
    title: 'A real path forward',
    body: 'RBT to BCaBA to BCBA, with mentorship at every step and the hours to get there.',
    accent: 'text-magenta-bright',
  },
];

const facts: { icon: LucideIcon; label: string }[] = [
  { icon: MapPin, label: 'Across South Florida' },
  { icon: Users, label: 'Full-time & part-time' },
  { icon: GraduationCap, label: 'Paid supervision' },
];

/** Reuses the role-card gradient vocabulary so the band belongs to this section. */
const CARD_GRADIENTS = roles.map((r) => r.gradient);

function TeamReviewCard({ review, index }: { review: TeamReview; index: number }) {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  return (
    <div
      className="relative h-full overflow-hidden rounded-2xl p-[1.5px]"
      style={{ background: gradient }}
    >
      <div className="relative flex h-full flex-col rounded-[15px] bg-ink-950/85 p-6 backdrop-blur-sm">
        <Quote
          size={34}
          className="pointer-events-none absolute right-4 top-3 text-gold/20"
          aria-hidden="true"
        />
        <div
          className="flex gap-1"
          role="img"
          aria-label={`${review.rating} out of 5 stars`}
        >
          {Array.from({ length: review.rating }, (_, i) => (
            <Star key={i} size={14} className="fill-gold text-gold" aria-hidden="true" />
          ))}
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-text-light/90">{review.quote}</p>
        <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white ring-1 ring-white/20"
            style={{ background: gradient }}
            aria-hidden="true"
          >
            {review.initials}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-text-light">
              {review.attribution}
            </span>
            <span className="block text-xs text-text-light/65">
              {[review.role, review.tenure, review.relationship].filter(Boolean).join(' · ')}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * "What our team says".
 *
 * Fallback contract, identical to the homepage carousel's: `null` (never heard
 * back) and `[]` (nobody has reviewed yet) BOTH render no list. There is no
 * bundled sample — inventing employee quotes would be a lie.
 *
 * The "Leave a review" button lives OUTSIDE the list on purpose. Putting the
 * only entry point inside an empty list is the chicken-and-egg bug: with zero
 * reviews there would be no way to leave the first one.
 */
function TeamVoices() {
  const { openDialog: openTeamReview } = useTeamReview();
  const [reviews, setReviews] = useState<TeamReview[]>([]);

  useEffect(() => {
    const ac = new AbortController();
    let live = true;
    const apply = (items: Awaited<ReturnType<typeof getTeamReviews>>) => {
      if (!live || items === null) return;
      setReviews(items);
    };
    getTeamReviews(ac.signal, apply).then(apply);
    return () => {
      live = false;
      ac.abort();
    };
  }, []);

  return (
    <div className="mt-16">
      {reviews.length > 0 && (
        <>
          <Reveal direction="up" className="text-center mx-auto max-w-2xl">
            <span className="text-teal-bright font-semibold text-xs tracking-[0.14em] uppercase">
              Team voices
            </span>
            <h3
              className="mt-3 text-text-light font-bold tracking-tight leading-[1.15]"
              style={{ fontSize: 'clamp(24px, 3.4vw, 36px)' }}
            >
              What our team says
            </h3>
            <p className="mt-3 text-text-light/75 text-[15px] leading-relaxed">
              Reviews from current and former CAL-ABA team members, in their own words.
            </p>
          </Reveal>

          <RevealGroup className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" stagger={0.09}>
            {reviews.map((review, i) => (
              <Reveal key={`${review.attribution}-${i}`} variantsMode direction="up">
                <TeamReviewCard review={review} index={i} />
              </Reveal>
            ))}
          </RevealGroup>
        </>
      )}

      <Reveal direction="up" delay={0.1} className="mt-8 text-center">
        <p className="text-sm text-text-light/70">
          {reviews.length > 0
            ? 'Worked here too? We’d love to hear from you.'
            : 'Are you a current or former CAL-ABA team member?'}
        </p>
        <button
          type="button"
          onClick={openTeamReview}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-7 py-3.5 text-[15px] font-semibold text-text-light ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20 hover:scale-[1.03]"
        >
          <Star size={17} className="fill-gold text-gold" aria-hidden="true" />
          Leave a review
        </button>
      </Reveal>
    </div>
  );
}

export default function Careers() {
  const { openDialog } = useApplication();

  return (
    <section
      id="careers"
      className="relative py-14 sm:py-24 md:py-32 overflow-hidden overflow-x-clip"
    >
      <AuroraField variant="careers" seams={false} />
      <ParticleField density={70} seed={11} shootingStars />
      <SectionSeams variant="careers" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10">
        <Reveal direction="up" className="text-center mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 ring-1 ring-teal-bright/40 backdrop-blur-sm">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-bright opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-bright" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-bright">
              Now hiring
            </span>
          </span>

          <h2
            className="mt-5 text-text-light font-bold tracking-tight leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 5vw, 54px)' }}
          >
            Do the best work <br className="hidden sm:block" />
            of your <span className="brand-gradient-text-bright">career</span>
          </h2>

          <p className="mt-5 text-text-light/80 text-lg leading-relaxed">
            We&rsquo;re hiring RBTs, BCaBAs and BCBAs across South Florida. If you believe
            children are limitless, we&rsquo;d love to meet you.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {facts.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 text-sm text-text-light/75"
              >
                <Icon size={15} className="text-gold-bright" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </Reveal>

        {/* Role cards — each opens the application with that position filled in */}
        <RevealGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" stagger={0.1}>
          {roles.map((role) => (
            <Reveal key={role.title} variantsMode direction="up">
              <button
                type="button"
                onClick={() => openDialog(role.title)}
                className="group relative h-full w-full overflow-hidden rounded-2xl p-[1.5px] text-left transition-transform duration-300 hover:-translate-y-1.5"
                style={{ background: role.gradient }}
                aria-label={`Apply as ${role.title}`}
              >
                <span className="relative flex h-full flex-col rounded-[15px] bg-ink-950/85 p-6 backdrop-blur-sm">
                  {/* hue wash that blooms on hover */}
                  <span
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-30"
                    style={{ background: role.gradient }}
                    aria-hidden="true"
                  />
                  <span className="relative">
                    <span
                      className={`block text-2xl font-extrabold tracking-tight ${role.accent}`}
                    >
                      {role.title}
                    </span>
                    <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.12em] text-text-light/60">
                      {role.tagline}
                    </span>
                    <span className="mt-4 block text-[15px] leading-relaxed text-text-light/85">
                      {role.blurb}
                    </span>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-text-light">
                      Apply as {role.title}
                      <ArrowRight
                        size={16}
                        className="transition-transform duration-200 group-hover:translate-x-1"
                      />
                    </span>
                  </span>
                </span>
              </button>
            </Reveal>
          ))}
        </RevealGroup>

        {/* Why work here */}
        <RevealGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" stagger={0.08}>
          {perks.map(({ icon: Icon, title, body, accent }) => (
            <Reveal key={title} variantsMode direction="up" className="flex gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                <Icon size={19} className={accent} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold text-text-light">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-text-light/70">
                  {body}
                </span>
              </span>
            </Reveal>
          ))}
        </RevealGroup>

        <TeamVoices />

        <Reveal direction="scale" delay={0.15} className="mt-14 text-center">
          <button
            type="button"
            onClick={() => openDialog()}
            className="animate-gold-pulse inline-flex items-center gap-2 rounded-full bg-gold px-9 py-4 text-[15px] font-semibold text-ink transition hover:scale-[1.03] hover:shadow-glow-gold"
          >
            Apply now
            <ArrowRight size={17} />
          </button>
          <p className="mt-4 text-sm text-text-light/65">
            Takes about three minutes — have your résumé handy.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

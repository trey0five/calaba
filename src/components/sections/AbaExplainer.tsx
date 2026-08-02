import { MessageCircle, UsersRound, Sparkles, LucideIcon } from 'lucide-react';
import SectionShell from '@/components/primitives/SectionShell';
import Reveal from '@/components/primitives/Reveal';
import RevealGroup from '@/components/primitives/RevealGroup';

type Card = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** medallion + underline fill */
  gradient: string;
  /** corner aura and hover shadow */
  glow: string;
  /** faint tint the card washes into on hover */
  wash: string;
};

const cards: Card[] = [
  {
    icon: MessageCircle,
    title: 'Communication',
    body: 'Speech, AAC, and functional language that reaches real listeners.',
    gradient: 'linear-gradient(135deg, #2FE0D8 0%, #0E5A56 100%)',
    glow: 'rgba(34,199,192,0.45)',
    wash: 'rgba(34,199,192,0.13)',
  },
  {
    icon: UsersRound,
    title: 'Social connection',
    body: 'Peer play, friendship-building, and family interaction.',
    gradient: 'linear-gradient(135deg, #FF6FB0 0%, #9C1F5B 100%)',
    glow: 'rgba(214,51,122,0.42)',
    wash: 'rgba(214,51,122,0.12)',
  },
  {
    icon: Sparkles,
    title: 'Daily living',
    body: 'Self-care, routines, and independence at every age.',
    gradient: 'linear-gradient(135deg, #FFC44D 0%, #B8451F 100%)',
    glow: 'rgba(245,176,39,0.45)',
    wash: 'rgba(245,176,39,0.14)',
  },
];

export default function AbaExplainer() {
  return (
    <SectionShell id="aba" field="aba">
      <Reveal direction="up" className="mb-12 max-w-3xl">
        <span className="text-teal-deep font-semibold text-xs tracking-[0.14em] uppercase">
          Understanding ABA
        </span>
        <h2
          className="mt-4 text-text-base font-bold tracking-tight leading-[1.1]"
          style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
        >
          ABA, done with your child — not to them.
        </h2>
        <p className="mt-4 text-text-base/85 text-lg leading-relaxed max-w-2xl">
          Applied Behavior Analysis is a science of learning. At CAL-ABA, we apply it through
          play, connection, and consent — building skills your child can actually use.
        </p>
      </Reveal>
      <RevealGroup
        stagger={0.1}
        data-auto-carousel
        className="flex items-stretch overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 -mx-6 px-6 pt-2 pb-4 mt-12 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:mx-0 md:px-0 md:pb-0 md:items-stretch"
      >
        {cards.map((c) => (
          <Reveal
            key={c.title}
            variantsMode
            direction="scale"
            style={{
              ['--grad' as string]: c.gradient,
              ['--glow' as string]: c.glow,
              ['--wash' as string]: c.wash,
            }}
            className="group snap-center shrink-0 w-[80vw] md:w-auto md:shrink self-stretch relative flex flex-col overflow-hidden rounded-[26px] bg-surface p-px shadow-card ring-1 ring-hair transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-2 hover:shadow-[0_32px_64px_-24px_var(--glow)]"
          >
            {/* gradient hairline that only resolves on hover */}
            <span
              className="pointer-events-none absolute inset-0 rounded-[26px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: 'var(--grad)' }}
              aria-hidden="true"
            />

            <div className="relative flex flex-1 flex-col rounded-[25px] bg-surface p-8">
              {/* corner aura in the card's own hue */}
              <span
                className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-70 transition-all duration-700 group-hover:scale-125 group-hover:opacity-100"
                style={{
                  background:
                    'radial-gradient(closest-side, var(--wash), transparent 72%)',
                }}
                aria-hidden="true"
              />

              {/* oversized ghost of the icon, watermarked into the corner */}
              <c.icon
                size={190}
                strokeWidth={1}
                className="pointer-events-none absolute -bottom-12 -right-10 text-ink opacity-[0.035] transition-transform duration-700 group-hover:-rotate-12 group-hover:scale-110"
                aria-hidden="true"
              />

              <span
                className="relative grid h-16 w-16 place-items-center rounded-[20px] text-white shadow-[0_12px_28px_-10px_var(--glow)] transition-all duration-500 group-hover:-rotate-6 group-hover:scale-105 group-hover:shadow-[0_18px_38px_-10px_var(--glow)]"
                style={{ background: 'var(--grad)' }}
              >
                <c.icon size={30} />
              </span>

              <h3 className="relative mt-6 font-bold text-ink" style={{ fontSize: '24px' }}>
                {c.title}
              </h3>
              {/* underline draws itself in on hover */}
              <span
                className="relative mt-3 block h-[3px] w-10 origin-left rounded-full transition-transform duration-500 ease-out group-hover:scale-x-[2.6]"
                style={{ background: 'var(--grad)' }}
                aria-hidden="true"
              />

              <p className="relative mt-4 text-[15px] leading-relaxed text-ink-muted">{c.body}</p>
            </div>
          </Reveal>
        ))}
      </RevealGroup>
    </SectionShell>
  );
}

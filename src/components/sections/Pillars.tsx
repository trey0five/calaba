import { ClipboardList, Users, HeartHandshake, LineChart, LucideIcon } from 'lucide-react';
import SectionShell from '@/components/primitives/SectionShell';
import Reveal, { RevealDirection } from '@/components/primitives/Reveal';

const cards: { icon: LucideIcon; title: string; body: string; accent: string; bar: string }[] = [
  {
    icon: ClipboardList,
    title: 'Customized treatment plans',
    body: "Goals built around your child's strengths, interests, and family priorities.",
    accent: 'text-teal-deep',
    bar: 'bg-teal',
  },
  {
    icon: Users,
    title: 'Family-centered care',
    body: 'Parent and sibling training is part of every plan, not an add-on.',
    accent: 'text-gold-deep',
    bar: 'bg-gold',
  },
  {
    icon: HeartHandshake,
    title: 'Neurodiversity-affirming',
    body: 'Client assent guides each session; dignity is non-negotiable.',
    accent: 'text-coral-deep',
    bar: 'bg-coral',
  },
  {
    icon: LineChart,
    title: 'Measurable progress',
    body: 'Data-driven adjustments so your family sees real, lasting change.',
    accent: 'text-magenta-deep',
    bar: 'bg-magenta',
  },
];

const directions: RevealDirection[] = ['left', 'up', 'right', 'up'];
const delays = [0, 0.08, 0.16, 0.24];

export default function Pillars() {
  return (
    <SectionShell field="pillars" className="overflow-x-clip">
      <Reveal direction="up" className="mb-12">
        <span className="text-teal-deep font-semibold text-xs tracking-[0.14em] uppercase">
          Why families choose us
        </span>
        <h2
          className="mt-4 text-text-base font-bold tracking-tight leading-[1.1]"
          style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
        >
          Care that adapts to your child
        </h2>
      </Reveal>
      <div
        data-auto-carousel
        className="flex items-stretch overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 -mx-6 px-6 pt-2 pb-4 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-6 md:overflow-visible md:mx-0 md:px-0 md:pb-0 md:items-stretch"
      >
        {cards.map((c, i) => (
          <Reveal
            key={c.title}
            direction={directions[i]}
            delay={delays[i]}
            className="snap-center shrink-0 w-[80vw] md:w-auto md:shrink self-stretch flex flex-col bg-surface text-ink border border-hair rounded-2xl shadow-card overflow-hidden"
          >
            <div className={`h-1 w-full ${c.bar}`} aria-hidden="true" />
            <div className="flex flex-col flex-1 p-8">
              <c.icon size={32} className={c.accent} />
              <h3 className="text-ink font-semibold text-lg mt-4">{c.title}</h3>
              <p className="text-ink-muted text-sm mt-2 leading-relaxed">{c.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

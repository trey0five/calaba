import { Fragment } from 'react';
import { Phone, Calendar, Sparkles, LucideIcon } from 'lucide-react';
import SectionShell from '@/components/primitives/SectionShell';
import Reveal, { RevealDirection } from '@/components/primitives/Reveal';
import RevealGroup from '@/components/primitives/RevealGroup';
import AuroraField from '@/components/primitives/AuroraField';

const steps: {
  num: string;
  icon: LucideIcon;
  title: string;
  body: string;
  numColor: string;
}[] = [
  {
    num: '01',
    icon: Phone,
    title: 'Reach out',
    body: "Send a quick message or call. We'll listen first.",
    numColor: 'text-teal-deep/[0.16]',
  },
  {
    num: '02',
    icon: Calendar,
    title: 'Free consultation',
    body: 'Meet your potential BCBA and discuss goals.',
    numColor: 'text-gold-deep/50',
  },
  {
    num: '03',
    icon: Sparkles,
    title: 'Begin therapy',
    body: 'Intake, assessment, and care begin in your preferred setting.',
    numColor: 'text-coral-deep/[0.18]',
  },
];

const stepDirections: RevealDirection[] = ['left', 'up', 'right'];

const longTail = [
  'Student Analyst Supervision',
  'Summer Camp & Social Skills',
  'Adult & Transition Services',
];

export default function Process() {
  return (
    <div className="relative overflow-hidden overflow-x-clip">
      <AuroraField variant="process" />
      <SectionShell className="bg-transparent">
        <Reveal direction="up" className="mb-12">
          <span className="text-teal-deep font-semibold text-xs tracking-[0.14em] uppercase">
            How to begin
          </span>
          <h2
            className="mt-4 text-text-base font-bold tracking-tight leading-[1.1]"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
          >
            Three simple steps to starting care
          </h2>
        </Reveal>
        <div
          data-auto-carousel
          className="flex items-stretch overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 -mx-6 px-6 pt-2 pb-4 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:mx-0 md:px-0 md:pb-0 md:items-stretch"
        >
          {steps.map((s, i) => (
            <Reveal
              key={s.num}
              direction={stepDirections[i]}
              className="snap-center shrink-0 w-[80vw] md:w-auto md:shrink relative bg-surface text-ink p-8 rounded-2xl border border-hair shadow-card overflow-hidden self-stretch flex flex-col"
            >
              <span
                className={`absolute top-3 right-5 font-bold leading-none ${s.numColor}`}
                style={{ fontSize: '72px' }}
              >
                {s.num}
              </span>
              <s.icon size={32} className="text-gold-deep relative z-10" />
              <h3 className="text-ink font-semibold mt-3 relative z-10" style={{ fontSize: '22px' }}>
                {s.title}
              </h3>
              <p className="text-ink-muted text-sm mt-2 leading-relaxed relative z-10">{s.body}</p>
            </Reveal>
          ))}
        </div>

        <RevealGroup
          stagger={0.06}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm"
        >
          {longTail.map((label, i) => (
            <Fragment key={label}>
              <Reveal variantsMode direction="fade" as="span">
                <a
                  href="#contact"
                  className="text-teal-deep underline-offset-4 hover:underline font-medium"
                >
                  {label}
                </a>
              </Reveal>
              {i < longTail.length - 1 && (
                <span className="text-text-muted" aria-hidden="true">·</span>
              )}
            </Fragment>
          ))}
        </RevealGroup>
      </SectionShell>
    </div>
  );
}

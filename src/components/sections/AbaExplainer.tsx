import { ArrowRight } from 'lucide-react';
import SectionShell from '@/components/primitives/SectionShell';
import Reveal from '@/components/primitives/Reveal';
import RevealGroup from '@/components/primitives/RevealGroup';
import { SKILLS } from '@/content/skills';
import { useSkillDialog } from '@/lib/dialogs';

export default function AbaExplainer() {
  const { openSkill } = useSkillDialog();

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
        {SKILLS.map((c) => (
          <Reveal
            key={c.title}
            variantsMode
            direction="scale"
            style={{
              ['--grad' as string]: c.gradient,
              ['--glow' as string]: c.glow,
              ['--wash' as string]: c.wash,
            }}
            className="group cursor-pointer snap-center shrink-0 w-[80vw] md:w-auto md:shrink self-stretch relative flex flex-col overflow-hidden rounded-[26px] bg-surface p-px shadow-card ring-1 ring-hair transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-2 hover:shadow-[0_32px_64px_-24px_var(--glow)] focus-within:-translate-y-2 focus-within:shadow-[0_32px_64px_-24px_var(--glow)]"
          >
            {/* gradient hairline that only resolves on hover */}
            <span
              className="pointer-events-none absolute inset-0 rounded-[26px] opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-within:opacity-100"
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

              {/* the button's ::after stretches over the whole card, so any
                  part of the tile opens the dialog while the link keeps its
                  accessible name and keyboard focus */}
              <button
                type="button"
                onClick={() => openSkill(c.id)}
                aria-label={`Learn more about ${c.title}`}
                className="inline-flex items-center gap-1 text-teal-deep font-semibold mt-auto pt-4 pb-1 text-sm self-start outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
              >
                <span className="relative inline-flex items-center gap-1">
                  Learn more
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-300 group-hover:translate-x-1.5"
                  />
                </span>
              </button>
            </div>
          </Reveal>
        ))}
      </RevealGroup>
    </SectionShell>
  );
}

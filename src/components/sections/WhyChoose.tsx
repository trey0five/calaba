import { Microscope, Award, Heart, CreditCard, Infinity as InfinityIcon, LucideIcon } from 'lucide-react';
import SectionShell from '@/components/primitives/SectionShell';
import Reveal from '@/components/primitives/Reveal';
import RevealGroup from '@/components/primitives/RevealGroup';

const items: {
  icon: LucideIcon;
  label: string;
  tag: string;
  ring: string;
  glyph: string;
}[] = [
  {
    icon: Microscope,
    label: 'Evidence-based',
    tag: 'Current, peer-reviewed practice',
    ring: 'bg-teal/[0.12]',
    glyph: 'text-teal-deep',
  },
  {
    icon: Award,
    label: 'BCBA-led',
    tag: 'Every plan supervised by a BCBA',
    ring: 'bg-gold/[0.12]',
    glyph: 'text-gold-deep',
  },
  {
    icon: Heart,
    label: 'Assent & dignity',
    tag: "Your child's yes guides each session",
    ring: 'bg-coral/[0.12]',
    glyph: 'text-coral-deep',
  },
  {
    icon: CreditCard,
    label: 'Insurance accepted',
    tag: 'Aetna, Florida Blue, Step Up For Students',
    ring: 'bg-magenta/[0.12]',
    glyph: 'text-magenta-deep',
  },
  {
    icon: InfinityIcon,
    label: 'Lifespan support',
    tag: 'Early intervention through adult transition',
    ring: 'bg-teal/[0.12]',
    glyph: 'text-teal-deep',
  },
];

export default function WhyChoose() {
  return (
    <SectionShell field="whychoose">
      <Reveal direction="up" className="mb-12">
        <span className="text-teal-deep font-semibold text-xs tracking-[0.14em] uppercase">
          Our difference
        </span>
        <h2
          className="mt-4 text-text-base font-bold tracking-tight leading-[1.1]"
          style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
        >
          Care you can trust, every step
        </h2>
      </Reveal>
      <RevealGroup
        stagger={0.1}
        className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6"
      >
        {items.map((it) => (
          <Reveal
            key={it.label}
            variantsMode
            direction="scale"
            className="text-center flex flex-col items-center"
          >
            <div className={`w-12 h-12 rounded-full ${it.ring} flex items-center justify-center`}>
              <it.icon size={24} className={it.glyph} />
            </div>
            <div className="text-base font-semibold text-text-base mt-3">{it.label}</div>
            <div className="text-text-muted text-sm mt-1 leading-snug">{it.tag}</div>
          </Reveal>
        ))}
      </RevealGroup>
    </SectionShell>
  );
}

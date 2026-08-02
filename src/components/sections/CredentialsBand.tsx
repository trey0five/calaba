import { ShieldCheck, Sparkles, Heart, Lock, LucideIcon } from 'lucide-react';
import Reveal from '@/components/primitives/Reveal';
import RevealGroup from '@/components/primitives/RevealGroup';
import AuroraField from '@/components/primitives/AuroraField';

const items: { icon: LucideIcon; label: string; accent: string }[] = [
  { icon: ShieldCheck, label: 'BACB Certified BCBAs', accent: 'text-teal-bright' },
  { icon: Sparkles, label: 'BHCOE-aligned practices', accent: 'text-gold-bright' },
  { icon: Heart, label: 'Neurodiversity-affirming', accent: 'text-coral-bright' },
  { icon: Lock, label: 'HIPAA-compliant', accent: 'text-magenta-bright' },
];

export default function CredentialsBand() {
  return (
    <div className="relative overflow-hidden bg-ink-850 py-6">
      <AuroraField variant="credentials" />

      {/* Soft gold hairline instead of a hard border-y — a full-bleed rule
          cuts a visible line right where the hero's glow is still fading. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
        aria-hidden="true"
      />

      {/* Short band: reveal as one calm group. A wide viewport margin plus a
          long stagger made the four items pop in sequence as the strip
          crossed the fold, which read as stuttering. */}
      <RevealGroup
        stagger={0.05}
        viewportMargin="0px 0px -40px 0px"
        className="relative z-10 max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-around gap-6 sm:gap-8"
      >
        {items.map(({ icon: Icon, label, accent }) => (
          <Reveal key={label} variantsMode direction="up" distance={8} className="flex items-center gap-2">
            <Icon size={18} className={accent} />
            <span className="uppercase tracking-wider text-xs text-text-light font-semibold">
              {label}
            </span>
          </Reveal>
        ))}
      </RevealGroup>
    </div>
  );
}

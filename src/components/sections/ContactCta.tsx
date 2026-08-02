import { Mail, Phone } from 'lucide-react';
import Reveal from '@/components/primitives/Reveal';
import AuroraField from '@/components/primitives/AuroraField';
import AuroraRibbon from '@/components/primitives/AuroraRibbon';
import { site } from '@/content/site';
import { useConsultation } from '@/lib/dialogs';

export default function ContactCta() {
  const { openDialog } = useConsultation();

  return (
    <section
      id="contact"
      className="relative overflow-hidden py-14 sm:py-24 md:py-32"
    >
      <AuroraField variant="contact" />
      {/* Light field: the ribbon stays a whisper (dark-section caps would shout) */}
      <AuroraRibbon
        mode="echo"
        echoOpacity={0.1}
        className="absolute z-0 w-[min(110vw,1800px)] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      />

      <div className="relative z-10 max-w-3xl mx-auto px-6 md:px-10 text-center">
        <div className="bg-surface/80 backdrop-blur-sm rounded-3xl px-8 py-10 sm:px-12 ring-1 ring-hair shadow-card">
          <Reveal direction="scale" scale={0.7} duration={0.9}>
            <h2
              className="font-bold text-text-base tracking-tight"
              style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}
            >
              Ready to start your child's journey?
            </h2>
            <p className="mt-4 text-lg text-text-muted max-w-2xl mx-auto">
              We answer every inquiry within one business day.
            </p>
          </Reveal>

          <Reveal direction="up" delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-8">
              <a
                href={`mailto:${site.contact.email}`}
                className="inline-flex items-center gap-2 text-ink font-medium hover:text-teal-deep transition"
              >
                <Mail size={18} className="text-teal-deep" />
                {site.contact.email}
              </a>
              <a
                href={`tel:${site.contact.phone.replace(/[^\d+]/g, '')}`}
                className="inline-flex items-center gap-2 text-ink font-medium hover:text-magenta-deep transition"
              >
                <Phone size={18} className="text-magenta-deep" />
                {site.contact.phone}
              </a>
            </div>
          </Reveal>

          <Reveal direction="scale" delay={0.3}>
            <button
              type="button"
              onClick={openDialog}
              className="animate-gold-pulse inline-flex items-center bg-gold text-ink px-8 py-4 mt-8 rounded-full font-semibold text-[15px] shadow-card hover:scale-[1.03] hover:shadow-glow-gold transition"
            >
              Schedule a consultation
            </button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

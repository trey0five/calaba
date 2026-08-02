import { Instagram, Facebook, Linkedin } from 'lucide-react';
import { site } from '@/content/site';
import AuroraField from '@/components/primitives/AuroraField';
import ParticleField from '@/components/primitives/ParticleField';

export default function Footer() {
  return (
    <footer className="relative bg-ink-950 text-text-light overflow-hidden">
      <AuroraField variant="footer" />
      <ParticleField density={45} seed={8} parallax={false} />
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center">
              <img
                src={site.logo}
                alt="CAL-ABA logo"
                className="h-36 w-auto sm:h-56 object-contain object-contain"
              />
            </div>
            <div className="-mt-8 flex items-center justify-center gap-4">
              <a href="#" aria-label="Instagram" className="hover:text-gold transition">
                <Instagram size={20} strokeWidth={1.6} />
              </a>
              <a href="#" aria-label="Facebook" className="hover:text-gold transition">
                <Facebook size={20} strokeWidth={1.6} />
              </a>
              <a href="#" aria-label="LinkedIn" className="hover:text-gold transition">
                <Linkedin size={20} strokeWidth={1.6} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="uppercase tracking-wider text-gold text-sm mb-4 font-semibold">
              Quick Links
            </h4>
            <ul className="space-y-2 text-sm">
              {site.navLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-text-light/80 hover:text-gold transition">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="uppercase tracking-wider text-gold text-sm mb-4 font-semibold">
              Services
            </h4>
            <ul className="space-y-2 text-sm">
              {site.services.map((s) => (
                <li key={s.title}>
                  <a href="#services" className="text-text-light/80 hover:text-gold transition">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="uppercase tracking-wider text-gold text-sm mb-4 font-semibold">
              Contact
            </h4>
            <ul className="space-y-2 text-sm text-text-light/80">
              <li>
                <a href={`tel:${site.contact.phone.replace(/[^\d+]/g, '')}`} className="hover:text-gold">
                  {site.contact.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${site.contact.email}`} className="hover:text-gold">
                  {site.contact.email}
                </a>
              </li>
              <li>{site.contact.hours}</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 text-center text-sm uppercase tracking-[0.14em] text-gold">
          Insurance Accepted: Aetna · Florida Blue · Step Up For Students
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-light-muted">
          <span>© 2026 CAL-ABA. All rights reserved.</span>
          <span>Built with care in Florida.</span>
        </div>
        <div className="mt-2 text-center text-xs text-text-light-muted">
          Photography via Unsplash, used with thanks.
        </div>
      </div>
    </footer>
  );
}

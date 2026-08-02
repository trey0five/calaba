import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X } from 'lucide-react';
import FadeIn from '@/components/primitives/FadeIn';
import { site } from '@/content/site';
import { useConsultation } from '@/lib/dialogs';
import { cn } from '@/lib/cn';

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { openDialog } = useConsultation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <FadeIn
      as="header"
      delay={0.1}
      className={cn(
        'sticky top-0 z-40 backdrop-blur border-b border-white/10 transition-shadow duration-300',
        scrolled ? 'bg-white/90 shadow-card' : 'bg-white/70',
      )}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-2 flex items-center justify-between">
        <a href="#top" className="flex items-center group">
          <img
            src={site.logo}
            alt="CAL-ABA logo"
            className="h-16 w-auto -my-3 sm:h-36 sm:-my-10 object-contain"
          />
        </a>

        <nav className="hidden md:flex items-center gap-7">
          {site.navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative text-text-base font-medium text-sm group/link"
            >
              {link.label}
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-gold transition-[width] duration-200 group-hover/link:w-full" />
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={openDialog}
          className="hidden md:inline-flex items-center bg-gold text-ink px-5 py-2.5 rounded-full font-semibold text-sm hover:shadow-glow-gold hover:scale-[1.02] transition"
        >
          Schedule consultation
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="md:hidden p-3 -mr-1 text-gold-deep"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          <Menu size={26} />
        </button>
      </div>

      {/* Portalled to <body>: the header's `backdrop-blur` creates a containing
          block for fixed descendants, so a `fixed inset-0` panel rendered here
          would be trapped inside the ~80px header instead of filling the
          viewport — which hid every link. */}
      {open &&
        createPortal(
          <div
            id="mobile-nav"
            className="md:hidden fixed inset-0 z-[90] bg-surface flex flex-col"
          >
            <div className="px-6 py-3 flex items-center justify-between border-b border-hair">
              <a href="#top" onClick={() => setOpen(false)} className="flex items-center">
                <img
                  src={site.logo}
                  alt="CAL-ABA logo"
                  className="h-14 w-auto object-contain"
                />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-3 -mr-1 text-gold-deep"
                aria-label="Close menu"
              >
                <X size={26} />
              </button>
            </div>
            <nav className="flex flex-col px-6 py-6 gap-1 flex-1 overflow-y-auto overscroll-contain">
              {site.navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-text-base font-medium text-lg py-3 border-b border-hair/60"
                >
                  {link.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openDialog();
                }}
                className="mt-6 inline-flex items-center justify-center bg-gold text-ink px-5 py-4 rounded-full font-semibold text-base"
              >
                Schedule consultation
              </button>
            </nav>
          </div>,
          document.body,
        )}

    </FadeIn>
  );
}

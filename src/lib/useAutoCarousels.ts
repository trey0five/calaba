import { useEffect } from 'react';
import { usePrefersReducedMotion } from './motion';

/**
 * Finds every element marked `data-auto-carousel` and auto-advances it
 * by one card every `intervalMs` while on mobile (< md). Pauses on user
 * interaction (touch / hover), resumes a few seconds after. Disabled
 * entirely when prefers-reduced-motion is on.
 *
 * Assumes each carousel's children are equal-width snap items separated
 * by the Tailwind `gap-4` (16px) used by the mobile carousel containers.
 */
export function useAutoCarousels(intervalMs = 3000) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (typeof window === 'undefined') return;

    const els = Array.from(
      document.querySelectorAll<HTMLElement>('[data-auto-carousel]'),
    );
    if (els.length === 0) return;

    const mql = window.matchMedia('(max-width: 767px)');
    const cleanups: Array<() => void> = [];

    els.forEach((el) => {
      let paused = false;
      let resumeTimer: number | undefined;

      const pause = () => {
        paused = true;
        if (resumeTimer) {
          window.clearTimeout(resumeTimer);
          resumeTimer = undefined;
        }
      };
      const resumeLater = () => {
        if (resumeTimer) window.clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(() => {
          paused = false;
        }, 4000);
      };

      el.addEventListener('pointerdown', pause, { passive: true });
      el.addEventListener('pointerup', resumeLater, { passive: true });
      el.addEventListener('mouseenter', pause);
      el.addEventListener('mouseleave', resumeLater);

      const id = window.setInterval(() => {
        if (paused) return;
        if (!mql.matches) return; // mobile only
        const first = el.firstElementChild as HTMLElement | null;
        if (!first) return;
        const step = first.offsetWidth + 16; // gap-4 = 16px
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) {
          el.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          el.scrollBy({ left: step, behavior: 'smooth' });
        }
      }, intervalMs);

      cleanups.push(() => {
        window.clearInterval(id);
        if (resumeTimer) window.clearTimeout(resumeTimer);
        el.removeEventListener('pointerdown', pause);
        el.removeEventListener('pointerup', resumeLater);
        el.removeEventListener('mouseenter', pause);
        el.removeEventListener('mouseleave', resumeLater);
      });
    });

    return () => cleanups.forEach((c) => c());
  }, [intervalMs, reduced]);
}

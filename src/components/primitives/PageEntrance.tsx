import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion';

/**
 * Page-load curtain. Two cosmic halves slide apart vertically while a
 * gold accent line flashes at the meeting point — a "shutter opening"
 * reveal that hands off to the Hero's AuroraRibbon draw-on as the curtain clears.
 */
export default function PageEntrance() {
  const reduced = usePrefersReducedMotion();
  const [hidden, setHidden] = useState(false);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    if (reduced) {
      const id = requestAnimationFrame(() => setHidden(true));
      return () => cancelAnimationFrame(id);
    }
  }, [reduced]);

  useEffect(() => {
    if (completed >= 2) setHidden(true);
  }, [completed]);

  if (hidden) return null;

  const ease = [0.85, 0, 0.15, 1] as const;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* Top half slides up */}
      <motion.div
        className="absolute top-0 left-0 right-0 bg-bg-deep"
        style={{ height: '51vh' }}
        initial={{ y: 0 }}
        animate={{ y: '-100%' }}
        transition={{ duration: 1.1, delay: 0.25, ease }}
        onAnimationComplete={() => setCompleted((c) => c + 1)}
      />

      {/* Bottom half slides down */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-bg-deep"
        style={{ height: '51vh' }}
        initial={{ y: 0 }}
        animate={{ y: '100%' }}
        transition={{ duration: 1.1, delay: 0.25, ease }}
        onAnimationComplete={() => setCompleted((c) => c + 1)}
      />

      {/* Gold accent line flashes at the seam as the halves part */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[2px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, #F5B027 30%, #FF8A6E 50%, #F5B027 70%, transparent 100%)',
          boxShadow: '0 0 40px rgba(245,176,39,0.7)',
          transformOrigin: 'center',
        }}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: [0, 1, 1, 0], scaleX: [0, 1, 1, 1] }}
        transition={{ duration: 1.35, delay: 0.1, times: [0, 0.25, 0.65, 1], ease: 'easeOut' }}
      />
    </div>
  );
}

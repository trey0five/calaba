import { useId, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from '@/lib/motion';

/**
 * The giant brand-infinity ribbon: a blurred glow pass (the single allowed
 * static CSS blur — the filter itself is never animated) plus a crisp echo
 * stroke offset by (24px, 18px). Scroll parallax is transform-only (y ±40px)
 * and gated on prefers-reduced-motion.
 *
 * The outer div takes the caller's positioning classes (including Tailwind
 * translates/rotates) — parallax lives on an inner motion.div so Framer's
 * inline transform never fights the positioning classes.
 */

/**
 * NOTE ON THE GLOW: a thin trace with a wide feGaussianBlur, never CSS blur.
 *
 * CSS `filter: blur()` rasterises the whole element into one GPU texture; at
 * the original 150vw that exceeded the max texture size on wide displays and
 * flickered. Call sites now cap their width in px, so an in-SVG blur has a
 * bounded surface and is safe.
 *
 * The glow blurs a NARROW stroke rather than a fat one — blurring a wide band
 * leaves a bright core with a visible edge (a halo), while a thin stroke
 * dissolves into light. Concentric stacked strokes were tried instead and
 * banded into visible onion rings.
 */

// A true Bernoulli lemniscate (x = a·cos t/(1+sin²t), y = a·sin t·cos t/(1+sin²t))
// sampled to beziers. The old hand-drawn path was two lopsided ovals whose
// crossing sat off-centre, which is what made it read as "off".
const INFINITY_PATH =
  'M 1105.0 200.0 C 1105.0 220.8, 1101.0 243.1, 1094.1 262.5 C 1087.3 282.0, 1076.2 300.9, 1063.8 316.5 C 1051.3 332.1, 1035.4 345.7, 1019.4 356.2 C 1003.4 366.7, 985.3 374.2, 967.7 379.4 C 950.2 384.6, 931.7 386.9, 914.2 387.4 C 896.7 388.0, 879.1 385.9, 862.5 382.8 C 846.0 379.7, 829.9 374.5, 814.6 368.7 C 799.4 362.8, 784.9 355.5, 771.0 347.8 C 757.2 340.1, 744.1 331.3, 731.5 322.3 C 719.0 313.3, 707.1 303.6, 695.5 293.8 C 684.0 284.0, 673.0 273.7, 662.2 263.4 C 651.4 253.1, 641.0 242.5, 630.7 232.0 C 620.3 221.4, 610.2 210.7, 600.0 200.0 C 589.8 189.3, 579.7 178.6, 569.3 168.0 C 559.0 157.5, 548.6 146.9, 537.8 136.6 C 527.0 126.3, 516.0 116.0, 504.5 106.2 C 492.9 96.4, 481.0 86.7, 468.5 77.7 C 455.9 68.7, 442.8 59.9, 429.0 52.2 C 415.1 44.5, 400.6 37.2, 385.4 31.3 C 370.1 25.5, 354.0 20.3, 337.5 17.2 C 320.9 14.1, 303.3 12.0, 285.8 12.6 C 268.3 13.1, 249.8 15.4, 232.3 20.6 C 214.7 25.8, 196.6 33.3, 180.6 43.8 C 164.6 54.3, 148.7 67.9, 136.2 83.5 C 123.8 99.1, 112.7 118.0, 105.9 137.5 C 99.0 156.9, 95.0 179.2, 95.0 200.0 C 95.0 220.8, 99.0 243.1, 105.9 262.5 C 112.7 282.0, 123.8 300.9, 136.2 316.5 C 148.7 332.1, 164.6 345.7, 180.6 356.2 C 196.6 366.7, 214.7 374.2, 232.3 379.4 C 249.8 384.6, 268.3 386.9, 285.8 387.4 C 303.3 388.0, 320.9 385.9, 337.5 382.8 C 354.0 379.7, 370.1 374.5, 385.4 368.7 C 400.6 362.8, 415.1 355.5, 429.0 347.8 C 442.8 340.1, 455.9 331.3, 468.5 322.3 C 481.0 313.3, 492.9 303.6, 504.5 293.8 C 516.0 284.0, 527.0 273.7, 537.8 263.4 C 548.6 253.1, 559.0 242.5, 569.3 232.0 C 579.7 221.4, 589.8 210.7, 600.0 200.0 C 610.2 189.3, 620.3 178.6, 630.7 168.0 C 641.0 157.5, 651.4 146.9, 662.2 136.6 C 673.0 126.3, 684.0 116.0, 695.5 106.2 C 707.1 96.4, 719.0 86.7, 731.5 77.7 C 744.1 68.7, 757.2 59.9, 771.0 52.2 C 784.9 44.5, 799.4 37.2, 814.6 31.3 C 829.9 25.5, 846.0 20.3, 862.5 17.2 C 879.1 14.1, 896.7 12.0, 914.2 12.6 C 931.7 13.1, 950.2 15.4, 967.7 20.6 C 985.3 25.8, 1003.4 33.3, 1019.4 43.8 C 1035.4 54.3, 1051.3 67.9, 1063.8 83.5 C 1076.2 99.1, 1087.3 118.0, 1094.1 137.5 C 1101.0 156.9, 1105.0 179.2, 1105.0 200.0 Z';

interface AuroraRibbonProps {
  /** full = blurred glow + echo stroke; echo / blur = a single pass */
  mode?: 'full' | 'echo' | 'blur';
  /** blurred-pass opacity, capped at .35 (keep ≤.12 on light fields) */
  blurOpacity?: number;
  /** echo-stroke opacity, capped at .25 */
  echoOpacity?: number;
  /** play the pathLength draw-on animation on the echo stroke (Hero) */
  drawOn?: boolean;
  className?: string;
}

export default function AuroraRibbon({
  mode = 'full',
  blurOpacity = 0.35,
  echoOpacity = 0.22,
  drawOn = false,
  className,
}: AuroraRibbonProps) {
  const reduced = usePrefersReducedMotion();
  const gradientId = useId();
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [-40, 40]);

  const showBlur = mode === 'full' || mode === 'blur';
  const showEcho = mode === 'full' || mode === 'echo';
  const blurAlpha = Math.min(blurOpacity, 0.35);
  const echoAlpha = Math.min(echoOpacity, 0.25);

  return (
    <div ref={ref} className={cn('pointer-events-none', className)} aria-hidden="true">
      <motion.div className="w-full h-full" style={reduced ? undefined : { y }}>
        <svg
          viewBox="0 0 1200 400"
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter
              id={`${gradientId}-glow`}
              x="-12%"
              y="-30%"
              width="124%"
              height="160%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur stdDeviation="17" />
            </filter>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2FE0D8" />
              <stop offset="35%" stopColor="#FFC44D" />
              <stop offset="65%" stopColor="#FF8A6E" />
              <stop offset="100%" stopColor="#FF6FB0" />
            </linearGradient>
          </defs>

          {showBlur && (
            <>
              {/* wide, very soft halo */}
              <path
                d={INFINITY_PATH}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={30}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={blurAlpha * 0.55}
                filter={`url(#${gradientId}-glow)`}
              />
              {/* tighter inner light so the trace still has a spine */}
              <path
                d={INFINITY_PATH}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={blurAlpha}
                filter={`url(#${gradientId}-glow)`}
              />
            </>
          )}

          {showEcho && (
            <g>
              {drawOn && !reduced ? (
                <motion.path
                  d={INFINITY_PATH}
                  fill="none"
                  stroke={`url(#${gradientId})`}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={echoAlpha}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2.4, delay: 1.45, ease: [0.16, 1, 0.3, 1] }}
                />
              ) : (
                <path
                  d={INFINITY_PATH}
                  fill="none"
                  stroke={`url(#${gradientId})`}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={echoAlpha}
                />
              )}
            </g>
          )}
        </svg>
      </motion.div>
    </div>
  );
}

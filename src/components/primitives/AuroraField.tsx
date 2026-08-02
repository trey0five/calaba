import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';

/**
 * "Aurora Loop" background system — per-section opaque fields carrying
 * pre-faded radial-gradient blooms (NO filter: blur — the fade lives in
 * the gradient itself), an optional seam fade on dark edges, and a static
 * film-grain overlay. Everything is absolute, aria-hidden, pointer-events
 * none, z-0 under the section content. Blooms animate transform only.
 */

export type AuroraVariant =
  | 'hero'
  | 'credentials'
  | 'pillars'
  | 'about'
  | 'founder'
  | 'team'
  | 'aba'
  | 'services'
  | 'whychoose'
  | 'process'
  | 'insurance'
  | 'testimonials'
  | 'blog'
  | 'careers'
  | 'contact'
  | 'footer'
  /* Admin SPA — mounted once behind the whole app, never per route. */
  | 'admin'
  | 'adminLogin';

interface AuroraFieldProps {
  variant: AuroraVariant;
  className?: string;
  /** Render the preset's seam fades here. Set false when a section needs the
   *  seams painted ABOVE its stars/ribbon — see SectionSeams. */
  seams?: boolean;
}

/**
 * Eased alpha ramp. A plain `color -> transparent` linear-gradient bands
 * visibly over these distances (reads as stepping), so approximate an
 * ease curve with explicit stops.
 */
function seamFade(hex: string, toTop: boolean) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const stops = [
    [0, 1], [10, 0.98], [22, 0.92], [35, 0.78], [48, 0.58],
    [62, 0.36], [76, 0.18], [88, 0.06], [100, 0],
  ] as const;
  const ramp = stops
    .map(([pos, a]) => `rgba(${r},${g},${b},${a}) ${pos}%`)
    .join(', ');
  return `linear-gradient(to ${toTop ? 'top' : 'bottom'}, ${ramp})`;
}

/** The seam fades alone, for sections that render them over decorations. */
export function SectionSeams({ variant }: { variant: AuroraVariant }) {
  const preset = PRESETS[variant];
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {preset.seamTop && (
        <div
          className="absolute inset-x-0 top-0 h-32"
          style={{ background: seamFade(preset.seamTop, false) }}
        />
      )}
      {preset.seamBottom && (
        <div
          className="absolute inset-x-0 bottom-0 h-32"
          style={{ background: seamFade(preset.seamBottom, true) }}
        />
      )}
    </div>
  );
}

interface Layer {
  style: CSSProperties;
  /** animation utility class — implies will-change: transform */
  anim?: string;
}

interface Preset {
  /** CSS background for the opaque field (omit to inherit section bg) */
  field?: string;
  /** grain opacity; 0 = section renders its own GrainOverlay on top */
  grain: number;
  layers: Layer[];
  /** flat color faded in over the top/bottom ~130px so blooms and
      stars melt cleanly into an adjacent section boundary */
  seamTop?: string;
  seamBottom?: string;
}

// Bright bloom hues (rgb triplets)
export const AURORA_TEAL = '47, 224, 216';
export const AURORA_GOLD = '255, 196, 77';
export const AURORA_CORAL = '255, 138, 110';
export const AURORA_MAGENTA = '255, 111, 176';


/** Pre-faded radial bloom — the soft edge is baked into the gradient. */
export function bloomStyle(
  rgb: string,
  alpha: number,
  size: string,
  pos: CSSProperties,
): CSSProperties {
  // Hard cap: on ultra-wide displays a vw-sized bloom becomes a multi-thousand
  // pixel composited layer, and four of them thrash GPU memory into flicker.
  const capped = `min(${size}, 1100px)`;
  return {
    position: 'absolute',
    width: capped,
    height: capped,
    background: `radial-gradient(closest-side, rgba(${rgb}, ${alpha}) 0%, transparent 70%)`,
    ...pos,
  };
}

const PRESETS: Record<AuroraVariant, Preset> = {
  // Hero renders its own blooms (Framer parallax layers), seam + grain on top.
  hero: {
    field: 'linear-gradient(180deg, #140A2E 0%, #1C0E3E 55%, #241348 100%)',
    grain: 0,
    layers: [],
  },
  credentials: {
    field: '#241348',
    grain: 0.05,
    layers: [],
  },
  pillars: {
    field: '#FFFBF5',
    grain: 0.045,
    layers: [
      {
        style: bloomStyle(AURORA_TEAL, 0.12, 'max(44vw, 380px)', { left: '-12%', top: '-16%' }),
        anim: 'animate-aurora-1',
      },
      {
        style: bloomStyle(AURORA_GOLD, 0.1, 'max(46vw, 400px)', { right: '-14%', bottom: '-20%' }),
        anim: 'animate-aurora-3',
      },
    ],
  },
  about: {
    field: '#FDF6EC',
    grain: 0.045,
    layers: [
      {
        style: bloomStyle(AURORA_MAGENTA, 0.12, 'max(46vw, 400px)', { right: '-16%', top: '12%' }),
        anim: 'animate-aurora-2',
      },
      {
        style: bloomStyle(AURORA_TEAL, 0.1, 'max(42vw, 360px)', { left: '-14%', bottom: '-18%' }),
        anim: 'animate-aurora-1',
      },
    ],
  },
  // Dark "spotlight" section between two paper neighbours.
  founder: {
    field: 'linear-gradient(180deg, #1C0E3E 0%, #241348 52%, #1C0E3E 100%)',
    grain: 0.06,
    seamTop: '#1C0E3E',
    seamBottom: '#1C0E3E',
    layers: [
      {
        style: bloomStyle(AURORA_GOLD, 0.34, 'max(46vw, 400px)', { left: '-10%', top: '2%' }),
        anim: 'animate-aurora-1',
      },
      {
        style: bloomStyle(AURORA_CORAL, 0.24, 'max(34vw, 300px)', { left: '4%', bottom: '-14%' }),
        anim: 'animate-aurora-3',
      },
      {
        style: bloomStyle(AURORA_MAGENTA, 0.26, 'max(44vw, 380px)', { right: '-12%', top: '-8%' }),
        anim: 'animate-aurora-2',
      },
      {
        style: bloomStyle(AURORA_TEAL, 0.2, 'max(40vw, 340px)', { right: '-10%', bottom: '-16%' }),
        anim: 'animate-aurora-4',
      },
    ],
  },
  team: {
    field: '#FDF6EC',
    grain: 0.045,
    layers: [
      {
        style: bloomStyle(AURORA_TEAL, 0.12, 'max(44vw, 380px)', { left: '-16%', top: '18%' }),
        anim: 'animate-aurora-1',
      },
      {
        style: bloomStyle(AURORA_MAGENTA, 0.12, 'max(44vw, 380px)', { right: '-16%', bottom: '-10%' }),
        anim: 'animate-aurora-2',
      },
    ],
  },
  aba: {
    field: '#FFFBF5',
    grain: 0.04,
    layers: [
      {
        style: bloomStyle(AURORA_TEAL, 0.1, 'max(48vw, 420px)', { right: '-10%', top: '22%' }),
        anim: 'animate-aurora-2',
      },
    ],
  },
  services: {
    field: '#FDF6EC',
    grain: 0.045,
    layers: [
      {
        style: bloomStyle(AURORA_TEAL, 0.14, 'max(40vw, 340px)', { left: '-14%', top: '-12%' }),
        anim: 'animate-aurora-1',
      },
      {
        style: bloomStyle(AURORA_GOLD, 0.16, 'max(42vw, 360px)', { right: '-14%', top: '-10%' }),
      },
      {
        style: bloomStyle(AURORA_CORAL, 0.14, 'max(40vw, 340px)', { left: '-12%', bottom: '-14%' }),
      },
      {
        style: bloomStyle(AURORA_MAGENTA, 0.16, 'max(42vw, 360px)', { right: '-12%', bottom: '-16%' }),
        anim: 'animate-aurora-2',
      },
    ],
  },
  whychoose: {
    field: '#FFFBF5',
    grain: 0.04,
    layers: [
      {
        style: bloomStyle(AURORA_GOLD, 0.12, 'max(44vw, 380px)', { left: '28%', top: '-22%' }),
        anim: 'animate-aurora-1',
      },
    ],
  },
  process: {
    field: '#F6F1FB',
    grain: 0.045,
    layers: [
      {
        style: bloomStyle(AURORA_MAGENTA, 0.12, 'max(40vw, 340px)', { left: '-14%', top: '18%' }),
        anim: 'animate-aurora-1',
      },
      {
        style: bloomStyle(AURORA_TEAL, 0.12, 'max(40vw, 340px)', { right: '-14%', top: '24%' }),
        anim: 'animate-aurora-2',
      },
    ],
  },
  insurance: {
    field: '#FFFBF5',
    grain: 0.04,
    layers: [
      {
        style: bloomStyle(AURORA_GOLD, 0.14, 'max(50vw, 440px)', { left: '25%', top: '18%' }),
        anim: 'animate-aurora-1',
      },
    ],
  },
  // Hero's four blooms mirrored horizontally, opacities x0.85
  testimonials: {
    field: '#1C0E3E',
    grain: 0.06,
    layers: [
      {
        style: bloomStyle(AURORA_TEAL, 0.47, 'max(48vw, 420px)', { right: '-8%', top: '6%' }),
        anim: 'animate-aurora-1',
      },
      {
        style: bloomStyle(AURORA_MAGENTA, 0.43, 'max(52vw, 460px)', { left: '-10%', top: '12%' }),
        anim: 'animate-aurora-2',
      },
      {
        style: bloomStyle(AURORA_GOLD, 0.38, 'max(40vw, 360px)', { right: '32%', bottom: '-28%' }),
        anim: 'animate-aurora-3',
      },
      {
        style: bloomStyle(AURORA_CORAL, 0.34, 'max(26vw, 240px)', { right: '8%', bottom: '10%' }),
        anim: 'animate-aurora-4',
      },
    ],
    seamTop: '#1C0E3E',
    seamBottom: '#1C0E3E',
  },
  blog: {
    field: '#FDF6EC',
    grain: 0.04,
    layers: [
      {
        style: bloomStyle(AURORA_CORAL, 0.1, 'max(42vw, 360px)', { left: '-14%', top: '-14%' }),
        anim: 'animate-aurora-1',
      },
      {
        style: bloomStyle(AURORA_TEAL, 0.1, 'max(42vw, 360px)', { right: '-14%', bottom: '-16%' }),
        anim: 'animate-aurora-2',
      },
    ],
  },
  // Recruitment spotlight — teal-shifted ink so it reads as its own thing
  // next to the purple ContactCta directly below it.
  careers: {
    field: 'linear-gradient(165deg, #0E2A3A 0%, #14183C 46%, #1E1046 100%)',
    grain: 0.06,
    seamTop: '#0E2A3A',
    seamBottom: '#1E1046',
    layers: [
      {
        style: bloomStyle(AURORA_TEAL, 0.34, 'max(48vw, 420px)', { left: '-12%', top: '-10%' }),
        anim: 'animate-aurora-1',
      },
      {
        style: bloomStyle(AURORA_GOLD, 0.26, 'max(44vw, 380px)', { right: '-12%', top: '6%' }),
        anim: 'animate-aurora-3',
      },
      {
        style: bloomStyle(AURORA_MAGENTA, 0.22, 'max(42vw, 360px)', { right: '-10%', bottom: '-18%' }),
        anim: 'animate-aurora-2',
      },
    ],
  },
  // Most intense composition on the page (converts the old white blur blobs
  // to radial-fade equivalents at the same corners).
  // Bright break between the Careers night above and the Footer night below.
  contact: {
    field: 'linear-gradient(160deg, #FFFBF5 0%, #FDF1F3 46%, #F4EFFB 100%)',
    grain: 0.045,
    layers: [
      {
        style: bloomStyle(AURORA_TEAL, 0.2, 'max(48vw, 420px)', { left: '-14%', top: '-12%' }),
        anim: 'animate-aurora-1',
      },
      {
        style: bloomStyle(AURORA_MAGENTA, 0.2, 'max(48vw, 420px)', { right: '-14%', top: '-10%' }),
        anim: 'animate-aurora-2',
      },
      {
        style: bloomStyle(AURORA_GOLD, 0.16, 'max(46vw, 400px)', { left: '28%', bottom: '-22%' }),
        anim: 'animate-aurora-3',
      },
      {
        style: bloomStyle(AURORA_CORAL, 0.12, 'max(34vw, 300px)', { left: '-8%', bottom: '-16%' }),
        anim: 'animate-aurora-4',
      },
    ],
  },
  // Admin working surface: quiet enough to read dense lists over.
  admin: {
    field: 'linear-gradient(180deg, #140A2E 0%, #1C0E3E 60%, #241348 100%)',
    grain: 0.05,
    layers: [
      {
        style: bloomStyle(AURORA_TEAL, 0.16, 'max(46vw, 400px)', { left: '-14%', top: '-10%' }),
        anim: 'animate-aurora-1',
      },
      {
        style: bloomStyle(AURORA_MAGENTA, 0.14, 'max(46vw, 400px)', { right: '-14%', top: '4%' }),
        anim: 'animate-aurora-2',
      },
      {
        style: bloomStyle(AURORA_GOLD, 0.12, 'max(44vw, 380px)', { left: '30%', bottom: '-22%' }),
        anim: 'animate-aurora-3',
      },
    ],
  },
  // Login: the same composition turned up, plus a fourth coral bloom.
  adminLogin: {
    field: 'linear-gradient(180deg, #140A2E 0%, #1C0E3E 60%, #241348 100%)',
    grain: 0.05,
    layers: [
      {
        style: bloomStyle(AURORA_TEAL, 0.34, 'max(46vw, 400px)', { left: '-14%', top: '-10%' }),
        anim: 'animate-aurora-1',
      },
      {
        style: bloomStyle(AURORA_MAGENTA, 0.3, 'max(46vw, 400px)', { right: '-14%', top: '4%' }),
        anim: 'animate-aurora-2',
      },
      {
        style: bloomStyle(AURORA_GOLD, 0.26, 'max(44vw, 380px)', { left: '30%', bottom: '-22%' }),
        anim: 'animate-aurora-3',
      },
      {
        style: bloomStyle(AURORA_CORAL, 0.22, 'max(34vw, 300px)', { right: '-8%', bottom: '-12%' }),
        anim: 'animate-aurora-4',
      },
    ],
  },
  footer: {
    field: '#140A2E',
    grain: 0.06,
    // No seamTop: the bloom band below IS the top-edge treatment, and a seam
    // wash over it clipped the band and left a visible horizontal line.
    layers: [
      // One wide multi-hue band bleeding down from the top edge.
      // The gradients are anchored AT the top (`at X% 0%`) and fade out well
      // inside the box — previously they were centred mid-box and were still
      // visible where the box ended, which cut a hard horizontal line across
      // the footer.
      {
        style: {
          position: 'absolute',
          insetInline: '-10%',
          top: 0,
          height: '420px',
          background: [
            `radial-gradient(46% 62% at 8% 0%, rgba(${AURORA_TEAL}, 0.16), transparent 72%)`,
            `radial-gradient(46% 62% at 38% 0%, rgba(${AURORA_GOLD}, 0.15), transparent 72%)`,
            `radial-gradient(46% 62% at 66% 0%, rgba(${AURORA_CORAL}, 0.15), transparent 72%)`,
            `radial-gradient(46% 62% at 94% 0%, rgba(${AURORA_MAGENTA}, 0.16), transparent 72%)`,
          ].join(', '),
        },
      },
    ],
  },
};

/** Static grain tile — exported so sections layering their own bloom
 *  stacks (Hero) can still put grain on top of everything. */
export function GrainOverlay({
  opacity,
  className,
}: {
  opacity: number;
  className?: string;
}) {
  return (
    <span
      className={cn('grain-overlay absolute inset-0 z-0', className)}
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}

export default function AuroraField({ variant, className, seams = true }: AuroraFieldProps) {
  const preset = PRESETS[variant];

  return (
    <div
      className={cn(
        'absolute inset-0 z-0 overflow-hidden pointer-events-none',
        className,
      )}
      style={preset.field ? { background: preset.field } : undefined}
      aria-hidden="true"
    >
      {preset.layers.map((layer, i) => (
        <div
          key={i}
          className={layer.anim}
          style={{
            ...layer.style,
            ...(layer.anim ? { willChange: 'transform' } : undefined),
          }}
        />
      ))}
      {seams && preset.seamTop && (
        <div
          className="absolute inset-x-0 top-0 h-32"
          style={{ background: seamFade(preset.seamTop, false) }}
        />
      )}
      {seams && preset.seamBottom && (
        <div
          className="absolute inset-x-0 bottom-0 h-32"
          style={{ background: seamFade(preset.seamBottom, true) }}
        />
      )}
      {preset.grain > 0 && <GrainOverlay opacity={preset.grain} />}
    </div>
  );
}

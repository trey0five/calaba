import { forwardRef, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { GrainOverlay } from '@/components/primitives/AuroraField';
import { cn } from '@/lib/cn';

/**
 * Shared surface + form primitives.
 *
 * These started life duplicated inside ConsultationDialog / ReviewDialog /
 * ApplicationDialog. They now live here so the admin SPA can wear exactly the
 * same clothes as the public dialogs — one field recipe, one panel recipe.
 */

/** Glassy field on an ink panel. */
export const fieldBase =
  'w-full rounded-xl border border-white/15 bg-white/[0.07] px-4 py-3 text-base text-white placeholder:text-white/50 outline-none transition focus:border-teal-bright focus:bg-white/[0.11] focus:ring-2 focus:ring-teal-bright/30';

/** Error state added on top of `fieldBase`. */
export const fieldError =
  'border-coral-bright focus:border-coral-bright focus:ring-coral-bright/30';

/** Select with our own chevron — native arrows don't read on the glass field. */
export function Select({
  id,
  value,
  onChange,
  invalid,
  className,
  children,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          fieldBase,
          'field-select appearance-none pr-11 cursor-pointer',
          invalid && 'border-coral-bright',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        size={18}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/60"
        aria-hidden="true"
      />
    </div>
  );
}

export function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5 text-[13px] font-semibold text-text-light">
      {children}
      {required && <span className="text-gold-bright"> *</span>}
    </label>
  );
}

/** Brand gradient per avatar so consecutive people/reviews feel distinct. */
export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #2FE0D8 0%, #0E5A56 100%)',
  'linear-gradient(135deg, #FF6FB0 0%, #9C1F5B 100%)',
  'linear-gradient(135deg, #FFC44D 0%, #B07C0F 100%)',
  'linear-gradient(135deg, #FF8A6E 0%, #B8451F 100%)',
];

/** The ink field every dialog panel is painted on. */
export const PANEL_BG = 'linear-gradient(180deg, #140A2E 0%, #1C0E3E 55%, #241348 100%)';

/**
 * Three-bloom radial layers, one set per dialog. Kept verbatim from the
 * original components so the extraction is pixel-identical.
 */
export const PANEL_BLOOMS = {
  /** ConsultationDialog + ServiceDialog: teal / magenta / gold */
  teal:
    'radial-gradient(closest-side, rgba(47,224,216,0.30), transparent 70%) -15% -10% / 65% 55% no-repeat, radial-gradient(closest-side, rgba(255,111,176,0.28), transparent 70%) 112% -6% / 62% 52% no-repeat, radial-gradient(closest-side, rgba(255,196,77,0.20), transparent 70%) 50% 112% / 80% 45% no-repeat',
  /** ServiceDialog: teal / magenta(.26) / gold */
  service:
    'radial-gradient(closest-side, rgba(47,224,216,0.30), transparent 70%) -15% -10% / 65% 55% no-repeat, radial-gradient(closest-side, rgba(255,111,176,0.26), transparent 70%) 112% -6% / 62% 52% no-repeat, radial-gradient(closest-side, rgba(255,196,77,0.20), transparent 70%) 50% 112% / 80% 45% no-repeat',
  /** ReviewDialog: gold / magenta / teal */
  gold:
    'radial-gradient(closest-side, rgba(255,196,77,0.28), transparent 70%) -12% -8% / 62% 52% no-repeat, radial-gradient(closest-side, rgba(255,111,176,0.26), transparent 70%) 112% -6% / 62% 52% no-repeat, radial-gradient(closest-side, rgba(47,224,216,0.22), transparent 70%) 50% 112% / 80% 45% no-repeat',
  /** ApplicationDialog: teal / gold / magenta */
  application:
    'radial-gradient(closest-side, rgba(47,224,216,0.30), transparent 70%) -15% -10% / 65% 55% no-repeat, radial-gradient(closest-side, rgba(255,196,77,0.26), transparent 70%) 112% -6% / 62% 52% no-repeat, radial-gradient(closest-side, rgba(255,111,176,0.20), transparent 70%) 50% 112% / 80% 45% no-repeat',
  /** ArticleDialog: blooms nudged down so the cover image stays clean */
  article:
    'radial-gradient(closest-side, rgba(47,224,216,0.28), transparent 70%) -15% 6% / 65% 55% no-repeat, radial-gradient(closest-side, rgba(255,111,176,0.24), transparent 70%) 112% 40% / 62% 52% no-repeat, radial-gradient(closest-side, rgba(255,196,77,0.20), transparent 70%) 50% 112% / 80% 45% no-repeat',
} as const;

export type PanelChromeProps = HTMLMotionProps<'div'> & {
  /** one of PANEL_BLOOMS, or any CSS background shorthand */
  blooms?: string;
  /** grain overlay opacity (0 disables it) */
  grain?: number;
  /** drop the default rounded-3xl (bottom sheets round only the top) */
  radiusClassName?: string;
  children?: ReactNode;
};

/**
 * The dialog panel recipe: opaque ink gradient + the three-bloom radial layer
 * + film grain, with the caller's content stacked above at z-10.
 *
 * It is a `motion.div` so the existing dialogs can keep passing their
 * enter/exit props, and the admin drawers can slide with it.
 */
const POSITIONED = /(?:^|\s)(?:absolute|fixed|sticky|static|relative)(?:\s|$)/;

export const PanelChrome = forwardRef<HTMLDivElement, PanelChromeProps>(function PanelChrome(
  {
    className,
    blooms = PANEL_BLOOMS.teal,
    grain = 0.06,
    radiusClassName = 'rounded-3xl',
    style,
    children,
    ...rest
  },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      className={cn(
        // `relative` is only a DEFAULT. Tailwind emits `.relative` after
        // `.absolute`, so hardcoding it here silently beat the Drawer's
        // `absolute inset-y-0 right-0`: the panel lost its height constraint,
        // the scrollable body grew past the viewport and the footer buttons
        // became unreachable on short screens (and the drawer slid in from the
        // left). Callers that position themselves must win.
        !POSITIONED.test(className ?? '') && 'relative',
        'overflow-hidden shadow-cosmic ring-1 ring-white/10',
        radiusClassName,
        className,
      )}
      style={{ background: PANEL_BG, ...style }}
      {...rest}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: blooms }}
        aria-hidden="true"
      />
      {grain > 0 && <GrainOverlay opacity={grain} />}
      {children}
    </motion.div>
  );
});

import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PhotoFrameProps {
  className?: string;
  /** Tailwind aspect/size classes for the inner image window. */
  innerClassName?: string;
  children: ReactNode;
}

/**
 * Consistent cosmic photo treatment: 1px teal→magenta gradient border,
 * magenta glow, and a subtle bottom purple fade overlay.
 * Used by About, Services, and Blog photos.
 */
export default function PhotoFrame({
  className,
  innerClassName,
  children,
}: PhotoFrameProps) {
  return (
    <div
      className={cn(
        'bg-gradient-to-br from-teal to-magenta p-px rounded-2xl shadow-glow-magenta',
        className,
      )}
    >
      <div
        className={cn(
          'relative rounded-[15px] overflow-hidden bg-bg-raised',
          innerClassName,
        )}
      >
        {children}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg-base/[0.12] to-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

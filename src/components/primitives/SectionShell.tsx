import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import AuroraField, { AuroraVariant } from '@/components/primitives/AuroraField';

interface SectionShellProps {
  id?: string;
  className?: string;
  eyebrow?: string;
  heading?: string;
  kicker?: string;
  centered?: boolean;
  children?: ReactNode;
  innerClassName?: string;
  /** Aurora Loop background field for this section */
  field?: AuroraVariant;
}

export default function SectionShell({
  id,
  className,
  eyebrow,
  heading,
  kicker,
  centered = false,
  children,
  innerClassName,
  field,
}: SectionShellProps) {
  return (
    <section
      id={id}
      className={cn('relative py-14 sm:py-24 md:py-32', field && 'overflow-hidden', className)}
    >
      {field && <AuroraField variant={field} />}
      <div className={cn('relative max-w-7xl mx-auto px-6 md:px-10', innerClassName)}>
        {(eyebrow || heading || kicker) && (
          <div className={cn('mb-12', centered && 'text-center mx-auto max-w-3xl')}>
            {eyebrow && (
              <div className={cn(centered && 'flex flex-col items-center')}>
                <span className="text-teal font-semibold text-xs tracking-[0.14em] uppercase">
                  {eyebrow}
                </span>
              </div>
            )}
            {heading && (
              <h2
                className="mt-4 text-text-base font-bold tracking-tight leading-[1.1]"
                style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
              >
                {heading}
              </h2>
            )}
            {kicker && (
              <p
                className={cn(
                  'mt-4 text-text-base/85 text-lg leading-relaxed max-w-2xl',
                  centered && 'mx-auto',
                )}
              >
                {kicker}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

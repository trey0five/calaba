import { ElementType, ReactNode } from 'react';
import Reveal from './Reveal';

interface FadeInProps {
  as?: ElementType;
  delay?: number;
  duration?: number;
  y?: number;
  once?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Thin shim around <Reveal> for backwards compatibility.
 * Delegates to <Reveal direction="up" distance={y ?? 16}>.
 * New code should use <Reveal /> directly.
 */
export default function FadeIn({
  as,
  delay,
  duration,
  y,
  once,
  className,
  children,
}: FadeInProps) {
  return (
    <Reveal
      as={as}
      direction="up"
      delay={delay}
      duration={duration}
      distance={y ?? 16}
      once={once}
      className={className}
    >
      {children}
    </Reveal>
  );
}

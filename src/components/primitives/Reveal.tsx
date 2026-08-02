import { CSSProperties, ElementType, ReactNode, useMemo } from 'react';
import { motion, Variants } from 'framer-motion';
import { easeOutExpo, usePrefersReducedMotion } from '@/lib/motion';

export type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade';

interface RevealProps {
  direction?: RevealDirection;
  /** inline style passthrough (e.g. CSS custom properties for hover glows) */
  style?: CSSProperties;
  delay?: number;
  duration?: number;
  distance?: number;
  scale?: number;
  once?: boolean;
  as?: ElementType;
  className?: string;
  viewportMargin?: string;
  /** Use only inside a <RevealGroup>. Standalone use will leave the element invisible. */
  variantsMode?: boolean;
  children: ReactNode;
}

type State = { opacity: number; x?: number; y?: number; scale?: number };

function getStates(
  direction: RevealDirection,
  distance: number,
  scale: number,
): { initial: State; animate: State } {
  switch (direction) {
    case 'up':
      return { initial: { opacity: 0, y: distance }, animate: { opacity: 1, y: 0 } };
    case 'down':
      return { initial: { opacity: 0, y: -distance }, animate: { opacity: 1, y: 0 } };
    case 'left':
      return {
        initial: { opacity: 0, x: -(distance * 1.5) },
        animate: { opacity: 1, x: 0 },
      };
    case 'right':
      return {
        initial: { opacity: 0, x: distance * 1.5 },
        animate: { opacity: 1, x: 0 },
      };
    case 'scale':
      return { initial: { opacity: 0, scale }, animate: { opacity: 1, scale: 1 } };
    case 'fade':
    default:
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
  }
}

export default function Reveal({
  direction = 'up',
  delay = 0,
  duration = 0.7,
  distance = 40,
  scale = 0.85,
  once = true,
  as,
  className,
  style,
  viewportMargin = '-80px 0px',
  variantsMode = false,
  children,
}: RevealProps) {
  const reduced = usePrefersReducedMotion();
  const Tag = (as ?? 'div') as ElementType;
  const MotionTag = useMemo(() => motion.create(Tag), [Tag]) as ElementType;

  if (reduced) {
    return (
      <Tag className={className} style={style}>
        {children}
      </Tag>
    );
  }

  const { initial, animate } = getStates(direction, distance, scale);
  const transition = { duration, delay, ease: easeOutExpo } as const;

  if (variantsMode) {
    const variants: Variants = {
      hidden: initial,
      show: { ...animate, transition },
    };
    return (
      <MotionTag className={className} style={style} variants={variants}>
        {children}
      </MotionTag>
    );
  }

  return (
    <MotionTag
      className={className}
      style={style}
      initial={initial}
      whileInView={animate}
      viewport={{ once, margin: viewportMargin }}
      transition={transition}
    >
      {children}
    </MotionTag>
  );
}

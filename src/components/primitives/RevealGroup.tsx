import { ElementType, ReactNode, useMemo, HTMLAttributes } from 'react';
import { motion, Variants } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion';

interface RevealGroupProps extends HTMLAttributes<HTMLElement> {
  stagger?: number;
  delay?: number;
  once?: boolean;
  viewportMargin?: string;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export default function RevealGroup({
  stagger = 0.08,
  delay = 0,
  once = true,
  viewportMargin = '-80px 0px',
  as,
  className,
  children,
  ...rest
}: RevealGroupProps) {
  const reduced = usePrefersReducedMotion();
  const Tag = (as ?? 'div') as ElementType;
  const MotionTag = useMemo(() => motion.create(Tag), [Tag]) as ElementType;

  if (reduced) {
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  const variants: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: viewportMargin }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

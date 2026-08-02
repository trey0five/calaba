import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { easeOutExpo, usePrefersReducedMotion } from '@/lib/motion';
import { PANEL_BLOOMS, PanelChrome } from '@/lib/ui';
import { iconBtn, useFocusTrap, useModalLayer, useScrollLock } from '../ui';

/**
 * Right-hand sheet on desktop; a draggable bottom sheet (or a full-screen
 * page with a back chevron) on phones. Same panel recipe as the public
 * dialogs, so the admin never feels like a different product.
 */
export default function Drawer({
  open,
  onClose,
  title,
  width = 420,
  mobile = 'sheet',
  blooms = PANEL_BLOOMS.teal,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  width?: number;
  mobile?: 'sheet' | 'full';
  blooms?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);
  const dragControls = useDragControls();
  const isTopLayer = useModalLayer(open);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useScrollLock(open);
  useFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;
    const t = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('input, textarea, select, button, a[href]')
        ?.focus();
    }, 120);
    return () => {
      window.clearTimeout(t);
      (returnFocusRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Only the top-most modal answers Esc. A ConfirmDialog opened from inside
      // this drawer used to close BOTH, destroying the draft behind it.
      if (e.key === 'Escape' && isTopLayer()) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, isTopLayer]);

  const desktopMotion = {
    initial: { x: width },
    animate: { x: 0 },
    exit: { x: width },
    transition: { duration: 0.42, ease: easeOutExpo },
  };
  const mobileMotion = {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
    transition: { duration: 0.38, ease: easeOutExpo },
  };

  /**
   * Drag-to-dismiss is driven ONLY from the grab handle.
   *
   * With Framer's default `dragListener`, setting `drag="y"` on the panel makes
   * it write `touch-action: pan-x` + `user-select: none` onto the whole sheet —
   * which silently killed vertical scrolling inside it. On a phone the Staff
   * edit sheet is taller than 88svh, so the lower fields became unreachable and
   * any attempt to scroll dismissed the sheet and discarded the draft.
   */
  const draggable = !isDesktop && mobile === 'sheet' && !reduced;
  const dragProps = draggable
    ? {
        drag: 'y' as const,
        dragListener: false,
        dragControls,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0, bottom: 0.4 },
        onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
          if (info.offset.y > 120 || info.velocity.y > 700) onClose();
        },
      }
    : {};

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          <motion.div
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
            initial={reduced ? false : { opacity: 0 }}
            animate={reduced ? undefined : { opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <PanelChrome
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Details'}
            blooms={blooms}
            radiusClassName={cn(
              isDesktop ? 'rounded-l-3xl' : mobile === 'full' ? 'rounded-none' : 'rounded-t-3xl',
            )}
            className={cn(
              'absolute flex flex-col',
              isDesktop
                ? 'inset-y-0 right-0 w-full'
                : mobile === 'full'
                  ? 'inset-0'
                  : 'inset-x-0 bottom-0 max-h-[88svh]',
            )}
            style={isDesktop ? { maxWidth: width } : undefined}
            {...(isDesktop ? desktopMotion : mobileMotion)}
            {...dragProps}
          >
            {/* Header */}
            <div className="relative z-10 flex items-center gap-3 border-b border-white/10 px-5 py-4">
              {!isDesktop && mobile === 'full' ? (
                <button type="button" onClick={onClose} aria-label="Back" className={iconBtn}>
                  <ChevronLeft size={18} />
                </button>
              ) : null}
              <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold text-text-light">
                {title}
              </h2>
              {(isDesktop || mobile === 'sheet') && (
                <button type="button" onClick={onClose} aria-label="Close" className={iconBtn}>
                  <X size={18} />
                </button>
              )}
            </div>

            {!isDesktop && mobile === 'sheet' && (
              // 44px-tall transparent grab target around the 4px visual bar —
              // it is the only surface that starts a drag.
              <span
                className="absolute left-1/2 top-0 z-20 flex h-11 w-24 -translate-x-1/2 items-start justify-center pt-1"
                style={draggable ? { touchAction: 'none' } : undefined}
                onPointerDown={draggable ? (e) => dragControls.start(e) : undefined}
                aria-hidden="true"
              >
                <span className="h-1 w-10 rounded-full bg-white/25" />
              </span>
            )}

            <div className="relative z-10 flex-1 overflow-y-auto px-5 py-5">{children}</div>

            {footer && (
              <div className="relative z-10 border-t border-white/10 bg-ink-950/40 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </PanelChrome>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

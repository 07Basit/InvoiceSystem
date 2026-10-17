import { useEffect, useState, type RefObject } from 'react';
import { ArrowUp } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

interface ScrollToTopProps {
  /** The element that actually scrolls (the page's main area, not the window). */
  targetRef: RefObject<HTMLElement>;
  /** Show the button once the page is scrolled this many pixels. */
  threshold?: number;
}

/** Floating "back to top" button that appears after you scroll down. */
export default function ScrollToTop({ targetRef, threshold = 400 }: ScrollToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const onScroll = () => setVisible(el.scrollTop > threshold);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [targetRef, threshold]);

  const goTop = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    targetRef.current?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div
      className={cn(
        'fixed bottom-5 right-5 z-40 transition-all duration-200 print:hidden sm:bottom-6 sm:right-6',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
      aria-hidden={!visible}
    >
      <Tooltip label="Back to top" align="end" placement="above">
        <button
          type="button"
          onClick={goTop}
          aria-label="Scroll to top"
          tabIndex={visible ? 0 : -1}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--brand-accent))] text-white shadow-lg transition-transform hover:scale-105 hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-accent))] focus-visible:ring-offset-2"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </Tooltip>
    </div>
  );
}

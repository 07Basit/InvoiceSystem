import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { flushSync } from 'react-dom';

interface FloatingOptions {
  width: number;
  height: number;
  alignRight?: boolean;
  /** Called when the field has scrolled completely out of sight (under a header, out of its scroll area): the dropdown should close. */
  onAnchorHidden?: () => void;
}

/** False when something that scrolls or clips (a modal body, the page) hides the whole field. */
function isAnchorVisible(anchor: HTMLElement, rect: DOMRect): boolean {
  if (rect.width === 0 && rect.height === 0) return true; // no layout to judge by (tests): don't close
  if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) return false;
  for (let el = anchor.parentElement; el && el !== document.body; el = el.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(el);
    if (/(auto|scroll|hidden|clip)/.test(`${overflowX} ${overflowY}`)) {
      const box = el.getBoundingClientRect();
      if (rect.bottom <= box.top || rect.top >= box.bottom || rect.right <= box.left || rect.left >= box.right) return false;
    }
  }
  return true;
}

/**
 * Where to draw a dropdown so it sits in front of everything. The dropdown is rendered in a portal on the page itself
 * (not inside the card that holds the field), so no card, pinned bar or gradient can paint over it.
 * It follows the field while the page scrolls, without lagging a frame behind. Above or below the field is decided once,
 * when it opens, so it never jumps from one side to the other mid-scroll; it closes if the field scrolls out of sight.
 */
export function useFloatingPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  { width, height, alignRight = false, onAnchorHidden }: FloatingOptions,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ top: 0, left: 0, opacity: 0 }) // invisible (but focusable) until placed;
  const hiddenRef = useRef(onAnchorHidden);
  hiddenRef.current = onAnchorHidden;

  useLayoutEffect(() => {
    if (!open) return;
    let placement: 'up' | 'down' | null = null;

    const place = (sync: boolean) => {
      const anchor = anchorRef.current;
      const rect = anchor?.getBoundingClientRect();
      if (!anchor || !rect) return;
      if (hiddenRef.current && !isAnchorVisible(anchor, rect)) { hiddenRef.current(); return; }
      const w = Math.min(width, window.innerWidth - 16);
      const left = Math.max(8, Math.min(alignRight ? rect.right - w : rect.left, window.innerWidth - w - 8));
      if (placement === null) {
        const below = window.innerHeight - rect.bottom;
        placement = below < height && rect.top > below ? 'up' : 'down';
      }
      const next: CSSProperties = placement === 'up' ? { left, width: w, bottom: window.innerHeight - rect.top + 4 } : { left, width: w, top: rect.bottom + 4 };
      const apply = () => setStyle((prev) => (prev.left === next.left && prev.width === next.width && prev.top === next.top && prev.bottom === next.bottom && prev.opacity === undefined ? prev : next));
      // while scrolling the page is painted right after this event, so the dropdown must be updated now, not a frame later
      if (sync) flushSync(apply); else apply();
    };

    const onResize = () => place(true);
    const onScroll = (e: Event) => {
      // scrolling the dropdown's own list must not move the dropdown
      if (e.target instanceof Element && e.target.closest('[data-floating-popup]')) return;
      place(true);
    };

    place(false);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, anchorRef, width, height, alignRight]);

  return style;
}

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/**
 * Where to draw a dropdown so it sits in front of everything. The dropdown is rendered in a portal on the page itself
 * (not inside the card that holds the field), so no card, pinned bar or gradient can paint over it.
 * It follows the field while the page scrolls and flips above it when there is no room below.
 */
export function useFloatingPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  { width, height, alignRight = false }: { width: number; height: number; alignRight?: boolean },
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ top: 0, left: 0, opacity: 0 }) // invisible (but focusable) until placed;

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const w = Math.min(width, window.innerWidth - 16);
      const left = Math.max(8, Math.min(alignRight ? rect.right - w : rect.left, window.innerWidth - w - 8));
      const below = window.innerHeight - rect.bottom;
      const up = below < height && rect.top > below;
      setStyle(up ? { left, width: w, bottom: window.innerHeight - rect.top + 4 } : { left, width: w, top: rect.bottom + 4 });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef, width, height, alignRight]);

  return style;
}

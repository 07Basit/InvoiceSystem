import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  /** Text shown on hover or keyboard focus. */
  label: string;
  children: ReactNode;
  /** Which edge of the trigger the bubble lines up with; use "end" for icons at a container's right edge. */
  align?: 'center' | 'end';
}

/**
 * Instant themed tooltip. The native `title` hint is slow and doesn't appear at all in some
 * embedded browsers, so icon-only buttons use this instead.
 */
export default function Tooltip({ label, children, align = 'center' }: TooltipProps) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute top-full z-30 mt-1.5 whitespace-nowrap rounded-md bg-foreground px-2 py-1',
          'text-[11px] font-medium text-background shadow-md opacity-0 transition-opacity duration-100',
          'group-hover/tip:opacity-100 group-focus-within/tip:opacity-100',
          align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2',
        )}
      >
        {label}
      </span>
    </span>
  );
}

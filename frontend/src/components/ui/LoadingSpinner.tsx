import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_MESSAGE, Scene, type LoaderVariant } from './LoaderScenes';

interface LoadingSpinnerProps {
  /** Covers the whole screen with the branded loader (app start, page chunks). */
  fullScreen?: boolean;
  className?: string;
  /** Text under the spinner. */
  message?: string;
  /** sm: a small ring (inside buttons and tight spots). md: a compact animated scene. lg: the full scene. */
  size?: 'sm' | 'md' | 'lg';
  /** Which picture to show: each kind of page has its own (invoices are shuffled, charts grow, a ship sails...). */
  variant?: LoaderVariant;
}

/** Seconds after which the loader explains that the wait is longer than usual. */
export const SLOW_AFTER_SECONDS = 4;
export const VERY_SLOW_AFTER_SECONDS = 20;

/** 0 while the wait is normal, 1 once it is slow, 2 once it is very slow. */
export function useSlowStage(): 0 | 1 | 2 {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    const slow = setTimeout(() => setStage(1), SLOW_AFTER_SECONDS * 1000);
    const verySlow = setTimeout(() => setStage(2), VERY_SLOW_AFTER_SECONDS * 1000);
    return () => { clearTimeout(slow); clearTimeout(verySlow); };
  }, []);
  return stage;
}

/** A ring with a bright arc travelling round it, for buttons and tight spots. */
function Ring({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 50 50" aria-hidden="true" className={cn('h-5 w-5 animate-spin motion-reduce:animate-none', className)} style={{ animationDuration: '0.9s' }}>
      <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4.5" className="stroke-[hsl(var(--primary)/0.12)]" />
      <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="34 92" className="stroke-[hsl(var(--brand-accent))]" />
    </svg>
  );
}

const SLOW_TEXT = 'Waking up the server. After a quiet period the first load can take up to a minute.';
const VERY_SLOW_TEXT = 'Still working on it. Thank you for your patience.';

function FullScreen({ message }: { message?: string }) {
  const stage = useSlowStage();
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <Scene variant="app" scale={1.1} />
      <div className="space-y-1">
        <p className="text-base font-bold tracking-tight text-foreground">InvoiceManager</p>
        <p className="text-sm text-muted-foreground">{message ?? DEFAULT_MESSAGE.app}</p>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-[hsl(var(--primary)/0.1)]" aria-hidden="true">
        <div className="loader-bar h-full w-1/3 rounded-full bg-[hsl(var(--brand-accent))]" />
      </div>
      <p className={cn('min-h-[2.5rem] max-w-xs text-xs text-muted-foreground transition-opacity duration-500', stage === 0 ? 'opacity-0' : 'opacity-100')}>
        {stage === 2 ? VERY_SLOW_TEXT : stage === 1 ? SLOW_TEXT : ''}
      </p>
    </div>
  );
}

function Inline({ className, message, size, variant }: { className?: string; message?: string; size: 'sm' | 'md' | 'lg'; variant: LoaderVariant }) {
  const stage = useSlowStage();
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className={cn('flex flex-col items-center gap-2 text-center', className)}>
      {size === 'sm' ? <Ring /> : <Scene variant={variant} scale={size === 'lg' ? 1 : 0.7} />}
      {size !== 'sm' || message ? <p className="text-sm text-muted-foreground">{message ?? DEFAULT_MESSAGE[variant]}</p> : null}
      {stage > 0 && size !== 'sm' ? <p className="max-w-xs text-xs text-muted-foreground">{stage === 2 ? VERY_SLOW_TEXT : SLOW_TEXT}</p> : null}
    </div>
  );
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ fullScreen, className, message, size = 'md', variant = 'app' }) =>
  fullScreen ? <FullScreen {...(message ? { message } : {})} /> : <Inline {...(className ? { className } : {})} {...(message ? { message } : {})} size={size} variant={variant} />;

export default LoadingSpinner;

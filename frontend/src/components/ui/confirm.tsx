import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for deletes and other hard-to-undo actions. */
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface Pending extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/**
 * In-app replacement for window.confirm(). Embedded browsers and desktop webviews often block the
 * native popup and silently answer "cancel", which made delete buttons look broken.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const answer = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') answer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, answer]);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
          onClick={() => answer(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={pending.message ? 'confirm-message' : undefined}
            className="w-full max-w-sm rounded-xl bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-base font-semibold">{pending.title}</h2>
            {pending.message && <p id="confirm-message" className="mt-1.5 text-sm text-muted-foreground">{pending.message}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => answer(false)} className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent">
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => answer(true)}
                className={cn(
                  'px-3 py-1.5 text-sm font-semibold rounded-md text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  pending.destructive
                    ? 'bg-destructive hover:opacity-90 focus-visible:ring-destructive'
                    : 'bg-[hsl(var(--brand-accent))] hover:opacity-90 focus-visible:ring-[hsl(var(--brand-accent))]',
                )}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </ConfirmContext.Provider>
  );
}

/** Falls back to the browser's confirm() when no provider is mounted (e.g. isolated tests). */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  return ctx ?? ((options) => Promise.resolve(window.confirm(options.message ?? options.title)));
}

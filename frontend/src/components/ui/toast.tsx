import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  message?: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (title: string, message?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** How long a toast stays: long enough to read, and errors linger longer. */
export const TOAST_DURATION_MS: Record<ToastType, number> = { success: 4500, info: 4500, error: 7000 };
/** After the pointer leaves a toast it gets this much time before closing. */
export const TOAST_AFTER_HOVER_MS = 2000;

const styles: Record<ToastType, { accent: string; icon: string; Icon: typeof Info }> = {
  success: { accent: 'border-l-green-500', icon: 'text-green-600', Icon: CheckCircle2 },
  error: { accent: 'border-l-red-500', icon: 'text-red-600', Icon: AlertCircle },
  info: { accent: 'border-l-blue-500', icon: 'text-blue-600', Icon: Info },
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const [hovered, setHovered] = useState(false);
  const everHovered = useRef(false);
  const { accent, icon, Icon } = styles[item.type];

  // Counts down while the pointer is away; hovering pauses it, and leaving gives a short grace period.
  useEffect(() => {
    if (hovered) return;
    const wait = everHovered.current ? TOAST_AFTER_HOVER_MS : TOAST_DURATION_MS[item.type];
    const timer = setTimeout(() => onClose(item.id), wait);
    return () => clearTimeout(timer);
  }, [hovered, item.id, item.type, onClose]);

  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => { everHovered.current = true; setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-xl border border-l-4 bg-background p-4 shadow-lg',
        'toast-enter',
        accent,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug">{item.title}</p>
        {item.message ? <p className="mt-1 text-sm leading-snug text-muted-foreground">{item.message}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onClose(item.id)}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((title: string, message?: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setItems((prev) => [...prev.slice(-3), { id, title, type, ...(message ? { message } : {}) }]); // at most 4 on screen
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onClose={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }

  return ctx;
}

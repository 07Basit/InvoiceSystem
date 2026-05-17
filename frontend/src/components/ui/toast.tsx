import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((title: string, message?: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setItems((prev) => [
      ...prev,
      {
        id,
        title,
        type,
        ...(message ? { message } : {}),
      },
    ]);

    setTimeout(() => remove(id), 3000);
  }, [remove]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-[340px] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={[
              'rounded-md border px-4 py-3 shadow-md transition-all bg-background',
              item.type === 'success' ? 'border-green-300' : '',
              item.type === 'error' ? 'border-red-300' : '',
              item.type === 'info' ? 'border-blue-300' : '',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                {item.message ? <p className="text-xs text-muted-foreground mt-1">{item.message}</p> : null}
              </div>
              <button
                onClick={() => remove(item.id)}
                className="text-xs text-muted-foreground hover:text-foreground"
                type="button"
              >
                x
              </button>
            </div>
          </div>
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

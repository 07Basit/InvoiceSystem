import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  message?: string;
  type: ToastType;
}

interface NotificationItem {
  id: number;
  title: string;
  message?: string;
  type: ToastType;
  createdAt: number;
  seen: boolean;
}

interface ToastContextValue {
  showToast: (title: string, message?: string, type?: ToastType) => void;
  activeCount: number;
  notifications: NotificationItem[];
  markAllAsSeen: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const notificationStorageKey = 'app-notifications-v1';

function readStoredNotifications() {
  try {
    const raw = localStorage.getItem(notificationStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NotificationItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item?.id === 'number' && typeof item?.createdAt === 'number').slice(0, 30);
  } catch {
    return [];
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => readStoredNotifications());

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((title: string, message?: string, type: ToastType = 'info') => {
    const createdAt = Date.now();
    const id = createdAt + Math.floor(Math.random() * 1000);
    setItems((prev) => [
      ...prev,
      {
        id,
        title,
        type,
        ...(message ? { message } : {}),
      },
    ]);

    setNotifications((prev) => {
      const next: NotificationItem[] = [
        {
          id,
          title,
          type,
          createdAt,
          seen: false,
          ...(message ? { message } : {}),
        },
        ...prev,
      ];

      return next.slice(0, 30);
    });

    setTimeout(() => remove(id), 1000);
  }, [remove]);

  const markAllAsSeen = useCallback(() => {
    setNotifications((prev) => prev.map((item) => (item.seen ? item : { ...item, seen: true })));
  }, []);

  useEffect(() => {
    localStorage.setItem(notificationStorageKey, JSON.stringify(notifications));
  }, [notifications]);

  const unseenCount = notifications.reduce((count, item) => count + (item.seen ? 0 : 1), 0);

  const value = useMemo(() => ({
    showToast,
    activeCount: unseenCount,
    notifications,
    markAllAsSeen,
  }), [showToast, unseenCount, notifications, markAllAsSeen]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[340px] flex-col gap-2 pointer-events-none">
        {items.map((item) => (
          <div
            key={item.id}
            className={[
              'rounded-md border px-4 py-3 shadow-md transition-all bg-background pointer-events-auto',
              item.type === 'success' ? 'border-green-300' : '',
              item.type === 'error' ? 'border-red-300' : '',
              item.type === 'info' ? 'border-blue-300' : '',
            ].join(' ')}
          >
            <div>
              <p className="text-sm font-semibold">{item.title}</p>
              {item.message ? <p className="text-xs text-muted-foreground mt-1">{item.message}</p> : null}
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

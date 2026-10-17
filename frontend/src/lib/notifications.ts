import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { NotificationCategory, NotificationType } from 'shared';

/** "just now", "5m ago", "3h ago", "2d ago", then the date for anything older than a week. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${Math.max(1, min)}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(then));
}

/** "Oct 17, 2026, 2:05 PM" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

export const typeStyle: Record<NotificationType, { label: string; icon: typeof Info; iconClass: string; badgeClass: string }> = {
  success: { label: 'Success', icon: CheckCircle2, iconClass: 'text-green-600 bg-green-100', badgeClass: 'bg-green-100 text-green-700' },
  info: { label: 'Info', icon: Info, iconClass: 'text-blue-600 bg-blue-100', badgeClass: 'bg-blue-100 text-blue-700' },
  warning: { label: 'Warning', icon: AlertTriangle, iconClass: 'text-amber-600 bg-amber-100', badgeClass: 'bg-amber-100 text-amber-700' },
  error: { label: 'Error', icon: AlertCircle, iconClass: 'text-red-600 bg-red-100', badgeClass: 'bg-red-100 text-red-700' },
};

export const categoryLabel: Record<NotificationCategory, string> = {
  invoice: 'Invoices',
  importer: 'Importers',
  currency: 'Currency',
  system: 'System',
};

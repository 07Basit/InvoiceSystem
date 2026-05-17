import { cn, formatCurrency, formatDate } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  className?: string;
}

const statusConfig = {
  DRAFT: { label: 'Draft', class: 'bg-gray-100 text-gray-700' },
  SENT: { label: 'Sent', class: 'bg-blue-100 text-blue-700' },
  PAID: { label: 'Paid', class: 'bg-green-100 text-green-700' },
  OVERDUE: { label: 'Overdue', class: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', class: 'bg-orange-100 text-orange-700' },
} as const;

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = statusConfig[status];
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.class, className)}>
      {config.label}
    </span>
  );
};

export { formatCurrency, formatDate };

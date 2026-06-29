import { cn, formatCurrency, formatDate } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  className?: string;
}

const statusConfig = {
  DRAFT: {
    label: 'Draft',
    class: 'bg-gray-100 text-gray-600 border border-gray-200',
    dot: 'bg-gray-400',
  },
  SENT: {
    label: 'Sent',
    class: 'bg-blue-50 text-blue-700 border border-blue-200',
    dot: 'bg-blue-500',
  },
  PAID: {
    label: 'Paid',
    class: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500',
  },
  OVERDUE: {
    label: 'Overdue',
    class: 'bg-red-50 text-red-700 border border-red-200',
    dot: 'bg-red-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    class: 'bg-orange-50 text-orange-700 border border-orange-200',
    dot: 'bg-orange-500',
  },
} as const;

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = statusConfig[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
      config.class,
      className
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)} />
      {config.label}
    </span>
  );
};

export { formatCurrency, formatDate };

import type { PaymentStatus, PaymentSummary } from 'shared';
import { cn } from '@/lib/utils';

const LABEL: Record<PaymentStatus, string> = { unpaid: 'Unpaid', partial: 'Part paid', paid: 'Paid', overpaid: 'Overpaid' };
const TONE: Record<PaymentStatus, string> = {
  unpaid: 'border-red-200 bg-red-50 text-red-700',
  partial: 'border-amber-200 bg-amber-50 text-amber-700',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  overpaid: 'border-sky-200 bg-sky-50 text-sky-700',
};

export const statusLabel = (status: PaymentStatus) => LABEL[status];

/** Whether an actual invoice is unpaid, part paid, paid or overpaid. */
const PaymentStatusBadge: React.FC<{ summary: Pick<PaymentSummary, 'status'>; className?: string }> = ({ summary, className }) => (
  <span className={cn('inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', TONE[summary.status], className)}>{LABEL[summary.status]}</span>
);

export default PaymentStatusBadge;

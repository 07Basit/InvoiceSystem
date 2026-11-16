import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The change in a price: red and up when it got dearer, green and down when it got cheaper. */
const ChangeBadge: React.FC<{ percent: number | null; className?: string }> = ({ percent, className }) => {
  if (percent === null) return <span className={cn('text-xs text-muted-foreground', className)}>first purchase</span>;
  const tone = percent > 0 ? 'bg-red-50 text-red-700' : percent < 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-secondary text-muted-foreground';
  const Icon = percent > 0 ? ArrowUpRight : percent < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn('inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', tone, className)}>
      <Icon className="h-3.5 w-3.5" /> {percent > 0 ? '+' : ''}{percent}%
    </span>
  );
};

export default ChangeBadge;

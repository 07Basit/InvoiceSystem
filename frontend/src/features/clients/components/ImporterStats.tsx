import { UserCheck, Users, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImporterStatsProps {
  total: number;
  active: number;
  inactive: number;
}

const tiles = [
  { key: 'total', label: 'Total importers', icon: Users, tone: 'bg-violet-100 text-violet-700' },
  { key: 'active', label: 'Active', icon: UserCheck, tone: 'bg-emerald-100 text-emerald-700' },
  { key: 'inactive', label: 'Inactive', icon: UserX, tone: 'bg-muted text-muted-foreground' },
] as const;

/** Three small count tiles shown above the importer cards. */
export default function ImporterStats({ total, active, inactive }: ImporterStatsProps) {
  const values = { total, active, inactive };
  return (
    <div className="grid grid-cols-3 gap-3" aria-label="Importer summary">
      {tiles.map(({ key, label, icon: Icon, tone }) => (
        <div key={key} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 sm:px-4">
          <div className={cn('hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight" data-testid={`importer-stat-${key}`}>{values[key]}</p>
            <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

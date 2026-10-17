import { ArrowRightLeft } from 'lucide-react';
import { useCurrencySettings, useSaveCurrencySettings } from '../hooks/useCurrencySettings';

interface BaseCurrencySelectProps {
  /** Currency the dashboard is currently reporting in (shown until the options load). */
  current: string;
}

const BaseCurrencySelect: React.FC<BaseCurrencySelectProps> = ({ current }) => {
  const { data } = useCurrencySettings();
  const save = useSaveCurrencySettings();
  const options = data?.currencies ?? [{ code: current, name: current }];

  return (
    <label className="flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-lg border text-xs font-semibold hover:bg-muted transition-colors">
      <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
      <span className="whitespace-nowrap">Reporting in</span>
      <select
        aria-label="Reporting currency"
        value={current}
        disabled={save.isPending}
        onChange={(e) => save.mutate({ baseCurrency: e.target.value })}
        className="bg-transparent text-xs font-semibold py-1 pr-1 focus:outline-none cursor-pointer disabled:opacity-50"
      >
        {options.map((c) => (
          <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
        ))}
      </select>
    </label>
  );
};

export default BaseCurrencySelect;

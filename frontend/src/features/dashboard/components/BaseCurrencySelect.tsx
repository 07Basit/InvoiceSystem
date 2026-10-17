import { ArrowRightLeft } from 'lucide-react';
import SearchCombobox from '@/components/ui/SearchCombobox';
import { toComboOption } from '@/lib/currencies';
import { useCurrencySettings, useSaveCurrencySettings } from '../hooks/useCurrencySettings';

interface BaseCurrencySelectProps {
  /** Currency the dashboard is currently reporting in (shown until the options load). */
  current: string;
}

const BaseCurrencySelect: React.FC<BaseCurrencySelectProps> = ({ current }) => {
  const { data } = useCurrencySettings();
  const save = useSaveCurrencySettings();
  const options = (data?.currencies ?? [{ code: current, name: current }]).map(toComboOption);

  return (
    <SearchCombobox
      value={current}
      options={options}
      ariaLabel="Reporting currency"
      searchPlaceholder="Search code or name, e.g. INR"
      disabled={save.isPending}
      onChange={(code) => code !== current && save.mutate({ baseCurrency: code })}
      display={current}
      align="right"
      className="px-3 py-2 rounded-lg border text-xs font-semibold hover:bg-muted transition-colors"
      leading={<><ArrowRightLeft className="h-3.5 w-3.5 shrink-0" /><span className="whitespace-nowrap">Reporting in</span></>}
    />
  );
};

export default BaseCurrencySelect;

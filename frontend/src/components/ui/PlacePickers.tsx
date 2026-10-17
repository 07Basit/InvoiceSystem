import { getCurrencyOptions, toComboOption } from '@/lib/currencies';
import { COMMON_AIRPORT_CODES, getCountryOptions, useAirportOptions } from '@/lib/places';
import { cn } from '@/lib/utils';
import SearchCombobox, { type ComboOption } from './SearchCombobox';

export interface SimplePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  /** "card" matches the importer cards; "form" matches the invoice form's inputs. */
  variant?: 'card' | 'form';
}

interface PickerFieldProps {
  variant?: 'card' | 'form';
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  common?: ComboOption[];
  error?: string | undefined;
  placeholder: string;
  searchPlaceholder: string;
  labelClassName?: string;
  loading?: boolean;
}

/** A labelled, searchable dropdown that looks like the text fields around it. */
export default function PickerField({ variant = 'card', label, value, onChange, options, common, error, placeholder, searchPlaceholder, labelClassName, loading }: PickerFieldProps) {
  // a value saved earlier that isn't in the list (e.g. an old free-text entry) still shows when editing
  const withCurrent = value && !loading && !options.some((o) => o.value === value)
    ? [{ value, label: value }, ...options]
    : options;

  return (
    <div>
      <label className={variant === 'form' ? 'label' : 'text-xs text-muted-foreground block mb-1'}>{label}</label>
      <SearchCombobox
        value={value}
        onChange={onChange}
        options={withCurrent}
        {...(common ? { common } : {})}
        ariaLabel={label}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        {...(labelClassName ? { labelClassName } : {})}
        loading={!!loading}
        hasError={!!error}
        className={cn(variant === 'form' ? 'input' : 'w-full border rounded-md px-3 py-2 text-sm bg-background')}
      />
      {error ? <p className={variant === 'form' ? 'err' : 'text-xs text-destructive mt-1'}>{error}</p> : null}
    </div>
  );
}


export function AirportSelect(props: SimplePickerProps) {
  const airports = useAirportOptions();
  const common = airports ? COMMON_AIRPORT_CODES.map((c) => airports.find((a) => a.value === c)).filter((a): a is ComboOption => !!a) : [];
  return (
    <PickerField
      {...props}
      options={airports ?? []}
      common={common}
      loading={!airports}
      placeholder="Select airport code"
      searchPlaceholder="Code, city or airport, e.g. BOM or Mumbai"
      labelClassName="w-10"
    />
  );
}

export function CountrySelect(props: SimplePickerProps) {
  return (
    <PickerField
      {...props}
      options={getCountryOptions()}
      placeholder="Select country"
      searchPlaceholder="Search country, e.g. India"
      labelClassName="w-auto"
    />
  );
}


export function CurrencySelect(props: SimplePickerProps) {
  const { common, all } = getCurrencyOptions();
  return (
    <PickerField
      {...props}
      options={all.map(toComboOption)}
      common={common.map(toComboOption)}
      placeholder="Select currency"
      searchPlaceholder="Search code or name, e.g. INR"
    />
  );
}

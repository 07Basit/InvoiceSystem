import { useMemo } from 'react';
import SearchCombobox, { type ComboOption } from '@/components/ui/SearchCombobox';
import { sanitizeNumber } from '@/components/ui/NumberInput';

/** Package weights (in KGS) offered in the dropdown. Anything else can still be typed. */
export const COMMON_WEIGHTS = [1, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];

/** 5 -> "5", 2.5 -> "2.5", 0.75 -> "0.75" */
const plain = (n: number) => String(Number(n.toFixed(3)));
const option = (n: number, description?: string): ComboOption => ({ value: plain(n), label: `${plain(n)} KGS`, keywords: plain(n), ...(description ? { description } : {}) });

interface WeightPickerProps {
  /** Nett weight per package in KGS (0 or undefined when empty) */
  value: number | string | undefined;
  onChange: (value: number | undefined) => void;
  ariaLabel: string;
  /** The usual weight the product list gives the chosen product; offered first */
  usual?: number | null;
  hasError?: boolean;
  className?: string;
}

/** Nett weight per package: pick a weight in KGS from the list (the product's usual weight on top), or type any other weight. */
export default function WeightPicker({ value, onChange, ariaLabel, usual = null, hasError, className }: WeightPickerProps) {
  const weight = Number(value) > 0 ? Number(value) : 0;
  const options = useMemo(() => {
    const list = [...COMMON_WEIGHTS];
    if (usual && !list.includes(usual)) list.push(usual);
    return list.sort((a, b) => a - b).map((n) => option(n));
  }, [usual]);
  const common = useMemo(() => (usual ? [option(usual, 'Usual for this product')] : []), [usual]);

  return (
    <SearchCombobox
      value={weight ? plain(weight) : ''}
      display={weight ? `${plain(weight)} KGS` : ''}
      onChange={(text) => {
        const n = Number(sanitizeNumber(text, { decimals: 3 }));
        if (Number.isFinite(n) && n > 0) onChange(n);
      }}
      options={options}
      common={common}
      commonLabel="This product"
      ariaLabel={ariaLabel}
      placeholder="Weight (KGS)"
      searchPlaceholder="Pick, or type a weight in KGS…"
      allowCustom
      labelClassName="w-20"
      {...(hasError !== undefined ? { hasError } : {})}
      className={className ?? 'w-full rounded border bg-background px-2 py-1 text-xs'}
    />
  );
}

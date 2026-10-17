import type { ComboOption } from '@/components/ui/SearchCombobox';

export interface CurrencyOption {
  code: string;
  name: string;
}

// Shown first in currency dropdowns because they are the most likely picks.
const COMMON = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'AED', 'SGD', 'JPY', 'CNY', 'CHF'];

let cache: { common: CurrencyOption[]; all: CurrencyOption[] } | null = null;

/** Every currency the browser knows (ISO 4217), with its English name. */
export function getCurrencyOptions(): { common: CurrencyOption[]; all: CurrencyOption[] } {
  if (cache) return cache;
  const names = new Intl.DisplayNames(['en'], { type: 'currency' });
  // Older TypeScript lib typings don't declare Intl.supportedValuesOf, but every current browser has it.
  const codes = (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('currency');
  const all = codes
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const common = COMMON.map((code) => all.find((c) => c.code === code)).filter((c): c is CurrencyOption => !!c);
  cache = { common, all };
  return cache;
}

export function toComboOption(c: CurrencyOption): ComboOption {
  return { value: c.code, label: c.code, description: c.name };
}

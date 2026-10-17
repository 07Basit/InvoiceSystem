import { useEffect, useState } from 'react';
import type { ComboOption } from '@/components/ui/SearchCombobox';
import countryCodes from '@/data/country-codes.json';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

const nameOf = (code: string) => {
  try { return regionNames.of(code) ?? code; } catch { return code; }
};

let countries: ComboOption[] | null = null;

/** Every country (ISO 3166-1), by English name. The stored value is the name, e.g. "India". */
export function getCountryOptions(): ComboOption[] {
  if (!countries) {
    countries = (countryCodes as string[])
      .map((code) => ({ code, name: nameOf(code) }))
      .filter((c) => c.name !== c.code) // drop codes the browser can't name
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.name, label: c.name, keywords: c.code }));
  }
  return countries;
}

// Most-used ports of loading/discharge for an export business; shown first while the search box is empty.
export const COMMON_AIRPORT_CODES = ['BOM', 'DEL', 'MAA', 'BLR', 'DXB', 'LHR', 'JFK', 'YUL', 'YYZ', 'JNB', 'SIN'];

type AirportRow = [iata: string, name: string, city: string, countryCode: string];

let airports: ComboOption[] | null = null;
let airportsLoading: Promise<ComboOption[]> | null = null;

function loadAirports(): Promise<ComboOption[]> {
  if (airports) return Promise.resolve(airports);
  // The dataset is ~280 KB, so it is only downloaded when a form that needs it opens.
  airportsLoading ??= import('@/data/airports.json').then((mod) => {
    const rows = (mod.default ?? mod) as unknown as AirportRow[];
    airports = rows.map(([iata, name, city, cc]) => {
      const country = nameOf(cc);
      const short = name.replace(/ International Airport$/, ' Intl').replace(/ Airport$/, '');
      return {
        value: iata,
        label: iata,
        description: `${city ? `${city}, ` : ''}${country} · ${short}`,
        keywords: `${name} ${city} ${country}`,
      };
    });
    return airports;
  });
  return airportsLoading;
}

/** Airport (IATA code) options, or null while the dataset is still loading. */
export function useAirportOptions(): ComboOption[] | null {
  const [options, setOptions] = useState<ComboOption[] | null>(airports);
  useEffect(() => {
    if (options) return;
    let live = true;
    void loadAirports().then((o) => { if (live) setOptions(o); });
    return () => { live = false; };
  }, [options]);
  return options;
}

import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { COMMON_AIRPORT_CODES, getCountryOptions, useAirportOptions } from '../places';

describe('getCountryOptions', () => {
  it('lists every country by English name, sorted, storing the name as the value', () => {
    const countries = getCountryOptions();
    expect(countries.length).toBeGreaterThan(200);
    const india = countries.find((c) => c.value === 'India');
    expect(india).toMatchObject({ label: 'India', keywords: 'IN' });
    expect(countries.map((c) => c.label)).toEqual([...countries.map((c) => c.label)].sort((a, b) => a.localeCompare(b)));
  });
});

describe('useAirportOptions', () => {
  it('loads airports keyed by IATA code with city and country to search on', async () => {
    const { result } = renderHook(() => useAirportOptions());
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).not.toBeNull());

    const airports = result.current!;
    expect(airports.length).toBeGreaterThan(3000);
    const bom = airports.find((a) => a.value === 'BOM');
    expect(bom?.label).toBe('BOM');
    expect(bom?.description).toContain('Mumbai');
    expect(bom?.description).toContain('India');
    expect(airports.some((a) => a.value === 'YUL')).toBe(true);
    expect(airports.some((a) => a.value === 'JNB')).toBe(true);
    for (const code of COMMON_AIRPORT_CODES) expect(airports.some((a) => a.value === code)).toBe(true);
  });
});

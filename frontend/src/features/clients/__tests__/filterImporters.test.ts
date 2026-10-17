import { describe, expect, it } from 'vitest';
import type { Importer } from '../services/clientService';
import { filterImporters } from '../utils/filterImporters';

const make = (over: Partial<Importer>): Importer => ({
  id: over.name ?? 'x', name: 'X', address: '', currency: 'USD', isActive: true,
  landingLocations: [], loadingLocations: [], createdAt: '', ...over,
});

const importers = [
  make({ name: 'North Maple Foods', buyerName: 'Jane Doe', currency: 'CAD', contact: '+1 514 555 0100',
    landingLocations: [{ id: 'l1', name: 'Montreal', portOfDischarge: 'YUL', finalDestination: 'YUL', countryOfDestination: 'Canada' }] }),
  make({ name: 'Mumbai Spice Imports', currency: 'INR', isActive: false,
    loadingLocations: [{ id: 'o1', name: 'Mumbai', portOfLoading: 'BOM', countryOfOrigin: 'India' }] }),
  make({ name: 'Gulf Fresh Trading', currency: 'EUR', email: 'ops@gulf.example' }),
];
const names = (list: Importer[]) => list.map((i) => i.name);

describe('filterImporters', () => {
  it('returns everything for an empty search and the "all" filter', () => {
    expect(filterImporters(importers, '', 'all')).toHaveLength(3);
    expect(filterImporters(importers, '   ', 'all')).toHaveLength(3);
  });

  it('filters by status', () => {
    expect(names(filterImporters(importers, '', 'active'))).toEqual(['North Maple Foods', 'Gulf Fresh Trading']);
    expect(names(filterImporters(importers, '', 'inactive'))).toEqual(['Mumbai Spice Imports']);
  });

  it('treats a missing isActive as active', () => {
    const legacy = [make({ name: 'Old', isActive: undefined as unknown as boolean })];
    expect(filterImporters(legacy, '', 'active')).toHaveLength(1);
    expect(filterImporters(legacy, '', 'inactive')).toHaveLength(0);
  });

  it('searches names, buyer, contact, email, currency, ports and countries, ignoring case', () => {
    expect(names(filterImporters(importers, 'MAPLE', 'all'))).toEqual(['North Maple Foods']);
    expect(names(filterImporters(importers, 'jane', 'all'))).toEqual(['North Maple Foods']);
    expect(names(filterImporters(importers, '555 0100', 'all'))).toEqual(['North Maple Foods']);
    expect(names(filterImporters(importers, 'gulf.example', 'all'))).toEqual(['Gulf Fresh Trading']);
    expect(names(filterImporters(importers, 'inr', 'all'))).toEqual(['Mumbai Spice Imports']);
    expect(names(filterImporters(importers, 'bom', 'all'))).toEqual(['Mumbai Spice Imports']);
    expect(names(filterImporters(importers, 'canada', 'all'))).toEqual(['North Maple Foods']);
  });

  it('requires every word to match, in any order', () => {
    expect(names(filterImporters(importers, 'foods maple', 'all'))).toEqual(['North Maple Foods']);
    expect(filterImporters(importers, 'maple india', 'all')).toHaveLength(0);
  });

  it('combines search with the status filter', () => {
    expect(filterImporters(importers, 'mumbai', 'active')).toHaveLength(0);
    expect(names(filterImporters(importers, 'mumbai', 'inactive'))).toEqual(['Mumbai Spice Imports']);
  });
});

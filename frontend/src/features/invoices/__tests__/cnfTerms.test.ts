import { describe, expect, it } from 'vitest';
import { cnfTerms } from '../components/InvoiceForm';

describe('cnfTerms', () => {
  it('is CNF plus the final destination code in capitals', () => {
    expect(cnfTerms('YYZ')).toBe('CNF YYZ');
    expect(cnfTerms(' bom ')).toBe('CNF BOM');
  });

  it('is just CNF while there is no destination', () => {
    expect(cnfTerms('')).toBe('CNF');
    expect(cnfTerms(undefined)).toBe('CNF');
    expect(cnfTerms(null)).toBe('CNF');
  });
});

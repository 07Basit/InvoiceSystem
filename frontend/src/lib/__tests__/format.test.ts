import { describe, expect, it } from 'vitest';
import { formatCountry, formatPortCode } from '../format';

describe('formatPortCode', () => {
  it('shows port and airport codes in capitals', () => {
    expect(formatPortCode('bom')).toBe('BOM');
    expect(formatPortCode(' yul ')).toBe('YUL');
    expect(formatPortCode(null)).toBe('');
    expect(formatPortCode(undefined)).toBe('');
  });
});

describe('formatCountry', () => {
  it('shows country names in Title Case whatever case they were typed in', () => {
    expect(formatCountry('canada')).toBe('Canada');
    expect(formatCountry('INDIA')).toBe('India');
    expect(formatCountry('united states')).toBe('United States');
    expect(formatCountry('  united arab emirates ')).toBe('United Arab Emirates');
  });

  it('keeps small joining words lower case, but not at the start', () => {
    expect(formatCountry('trinidad AND tobago')).toBe('Trinidad and Tobago');
    expect(formatCountry('the gambia')).toBe('The Gambia');
    expect(formatCountry('guinea-bissau')).toBe('Guinea-Bissau');
  });

  it('copes with empty values', () => {
    expect(formatCountry('')).toBe('');
    expect(formatCountry(null)).toBe('');
  });
});

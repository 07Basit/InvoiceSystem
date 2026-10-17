// Display formatting for values people type in different cases ("bom", "canada", "UNITED STATES").
// Only what is shown changes; stored values are left as entered.

const SMALL_WORDS = new Set(['of', 'and', 'the', 'in', 'on', 'at', 'to', 'for', 'by', 'da', 'de', 'del', 'la']);

/** Airport / port codes are shown in capitals: "bom" -> "BOM". */
export function formatPortCode(value?: string | null): string {
  return (value ?? '').trim().toUpperCase();
}

/** Country names are shown in Title Case: "united states" -> "United States", "trinidad and tobago" stays lower on "and". */
export function formatCountry(value?: string | null): string {
  const text = (value ?? '').trim();
  if (!text) return '';
  return text
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part, index) => (/^[a-z]/.test(part) && (index === 0 || !SMALL_WORDS.has(part)) ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join('');
}

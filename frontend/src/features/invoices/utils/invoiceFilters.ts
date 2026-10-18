import type { ListInvoicesInput } from 'shared';

export type InvoiceType = 'all' | 'regular' | 'actual';
/** Normal, party or custom invoices (all of them when 'all') */
export type InvoiceKindFilter = 'all' | 'normal' | 'party' | 'custom' | 'both';

/** Everything the invoice list can be narrowed by. Lists mean "any of these". */
export interface InvoiceFilterValues {
  importerIds: string[];
  currencies: string[];
  years: string[];
  months: string[];
  /** Invoice date range, "YYYY-MM-DD" or "" */
  dateFrom: string;
  dateTo: string;
  /** Invoice total range, as typed ("" = no limit) */
  minTotal: string;
  maxTotal: string;
  loadingPorts: string[];
  dischargePorts: string[];
  countries: string[];
  products: string[];
  exporters: string[];
  type: InvoiceType;
  kind: InvoiceKindFilter;
}

export const noFilters: InvoiceFilterValues = {
  importerIds: [], currencies: [], years: [], months: [], dateFrom: '', dateTo: '', minTotal: '', maxTotal: '',
  loadingPorts: [], dischargePorts: [], countries: [], products: [], exporters: [], type: 'all', kind: 'all',
};

const LIST_KEYS = ['importerIds', 'currencies', 'years', 'months', 'loadingPorts', 'dischargePorts', 'countries', 'products', 'exporters'] as const;

/** The filters as URL parameters: lists become comma-separated text, empty ones are left out. */
export function filtersToQuery(filters: InvoiceFilterValues): Partial<ListInvoicesInput> {
  const joined = (list: string[]) => (list.length ? list.join(',') : undefined);
  const amount = (text: string) => (text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : undefined);
  const entries: Array<[string, unknown]> = [
    ['importerId', joined(filters.importerIds)],
    ['currency', joined(filters.currencies)],
    ['year', joined(filters.years)],
    ['month', joined(filters.months)],
    ['dateFrom', filters.dateFrom || undefined],
    ['dateTo', filters.dateTo || undefined],
    ['minTotal', amount(filters.minTotal)],
    ['maxTotal', amount(filters.maxTotal)],
    ['loadingPort', joined(filters.loadingPorts)],
    ['dischargePort', joined(filters.dischargePorts)],
    ['country', joined(filters.countries)],
    ['product', joined(filters.products)],
    ['exporter', joined(filters.exporters)],
    ['type', filters.type !== 'all' ? filters.type : undefined],
    ['kind', filters.kind !== 'all' ? filters.kind : undefined],
  ];
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined)) as Partial<ListInvoicesInput>;
}

/** How many separate things are filtered (a date range or an amount range counts once). */
export function countActive(filters: InvoiceFilterValues): number {
  let count = LIST_KEYS.filter((key) => filters[key].length > 0).length;
  if (filters.dateFrom || filters.dateTo) count++;
  if (filters.minTotal.trim() || filters.maxTotal.trim()) count++;
  if (filters.type !== 'all') count++;
  if (filters.kind !== 'all') count++;
  return count;
}

export const isEmptyFilters = (filters: InvoiceFilterValues) => countActive(filters) === 0;

export type QuickDate = 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear';

export const QUICK_DATES: { id: QuickDate; label: string }[] = [
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'thisYear', label: 'This year' },
  { id: 'lastYear', label: 'Last year' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** The date range a quick choice stands for ("today" is passed in so it can be tested). */
export function quickRange(id: QuickDate, today: Date): { dateFrom: string; dateTo: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const lastDay = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  switch (id) {
    case 'thisMonth': return { dateFrom: ymd(y, m, 1), dateTo: ymd(y, m, lastDay(y, m)) };
    case 'lastMonth': { const py = m === 0 ? y - 1 : y; const pm = m === 0 ? 11 : m - 1; return { dateFrom: ymd(py, pm, 1), dateTo: ymd(py, pm, lastDay(py, pm)) }; }
    case 'thisYear': return { dateFrom: ymd(y, 0, 1), dateTo: ymd(y, 11, 31) };
    case 'lastYear': return { dateFrom: ymd(y - 1, 0, 1), dateTo: ymd(y - 1, 11, 31) };
  }
}

/** Which quick choice, if any, the current date range is exactly. */
export function activeQuickDate(filters: Pick<InvoiceFilterValues, 'dateFrom' | 'dateTo'>, today: Date): QuickDate | null {
  return QUICK_DATES.find(({ id }) => { const r = quickRange(id, today); return r.dateFrom === filters.dateFrom && r.dateTo === filters.dateTo; })?.id ?? null;
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface FilterChip {
  /** Which filter this chip belongs to, and (for lists) which value */
  key: keyof InvoiceFilterValues | 'dates' | 'amount';
  value?: string;
  label: string;
}

const shortDate = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${Number(m[3])} ${MONTH_NAMES[Number(m[2]) - 1]!.slice(0, 3)} ${m[1]}` : value;
};

/** One removable chip per chosen value, in reading order. `importerName` turns an importer id into its name. */
export function filterChips(filters: InvoiceFilterValues, importerName: (id: string) => string, formatCountry: (name: string) => string = (v) => v): FilterChip[] {
  const chips: FilterChip[] = [];
  filters.importerIds.forEach((id) => chips.push({ key: 'importerIds', value: id, label: importerName(id) }));
  filters.currencies.forEach((c) => chips.push({ key: 'currencies', value: c, label: c }));
  filters.years.forEach((y) => chips.push({ key: 'years', value: y, label: y }));
  filters.months.forEach((m) => chips.push({ key: 'months', value: m, label: MONTH_NAMES[Number(m) - 1] ?? m }));
  if (filters.dateFrom || filters.dateTo) {
    chips.push({ key: 'dates', label: filters.dateFrom && filters.dateTo ? `${shortDate(filters.dateFrom)} to ${shortDate(filters.dateTo)}` : filters.dateFrom ? `From ${shortDate(filters.dateFrom)}` : `Until ${shortDate(filters.dateTo)}` });
  }
  if (filters.minTotal.trim() || filters.maxTotal.trim()) {
    const min = filters.minTotal.trim(); const max = filters.maxTotal.trim();
    chips.push({ key: 'amount', label: min && max ? `Amount ${min} to ${max}` : min ? `Amount at least ${min}` : `Amount up to ${max}` });
  }
  filters.loadingPorts.forEach((p) => chips.push({ key: 'loadingPorts', value: p, label: `From ${p}` }));
  filters.dischargePorts.forEach((p) => chips.push({ key: 'dischargePorts', value: p, label: `To ${p}` }));
  filters.countries.forEach((c) => chips.push({ key: 'countries', value: c, label: formatCountry(c) }));
  filters.products.forEach((p) => chips.push({ key: 'products', value: p, label: p }));
  filters.exporters.forEach((e) => chips.push({ key: 'exporters', value: e, label: e }));
  if (filters.type !== 'all') chips.push({ key: 'type', label: filters.type === 'actual' ? 'Actual only' : 'Regular only' });
  if (filters.kind !== 'all') chips.push({ key: 'kind', label: filters.kind === 'custom' ? 'Custom invoices' : filters.kind === 'party' ? 'Party invoices' : filters.kind === 'both' ? 'Party + custom invoices' : 'Normal invoices' });
  return chips;
}

/** The filters without the value a chip stands for. */
export function removeChip(filters: InvoiceFilterValues, chip: FilterChip): InvoiceFilterValues {
  switch (chip.key) {
    case 'dates': return { ...filters, dateFrom: '', dateTo: '' };
    case 'amount': return { ...filters, minTotal: '', maxTotal: '' };
    case 'type': return { ...filters, type: 'all' };
    case 'kind': return { ...filters, kind: 'all' };
    default: {
      const key = chip.key as (typeof LIST_KEYS)[number];
      return { ...filters, [key]: filters[key].filter((v) => v !== chip.value) };
    }
  }
}

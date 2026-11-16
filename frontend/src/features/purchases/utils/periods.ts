const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface Period {
  id: string;
  label: string;
  range: (today: Date) => { from: string; to: string };
}

/** Ready-made date ranges for the reports. The financial year runs April to March. */
export const PERIODS: Period[] = [
  { id: 'month', label: 'This month', range: (t) => ({ from: ymd(new Date(t.getFullYear(), t.getMonth(), 1)), to: ymd(new Date(t.getFullYear(), t.getMonth() + 1, 0)) }) },
  { id: 'last-month', label: 'Last month', range: (t) => ({ from: ymd(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: ymd(new Date(t.getFullYear(), t.getMonth(), 0)) }) },
  { id: '30', label: 'Last 30 days', range: (t) => ({ from: ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 29)), to: ymd(t) }) },
  {
    id: 'fy',
    label: 'This financial year',
    range: (t) => {
      const start = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1;
      return { from: ymd(new Date(start, 3, 1)), to: ymd(new Date(start + 1, 2, 31)) };
    },
  },
  { id: 'all', label: 'All time', range: () => ({ from: '', to: '' }) },
];

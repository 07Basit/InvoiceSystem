import type { PricePoint } from 'shared';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Percent change from one rate to the next; null when there is nothing to compare with. */
export const changePercent = (latest: number, previous: number | null | undefined): number | null =>
  previous && previous > 0 ? round2(((latest - previous) / previous) * 100) : null;

/** A purchase with its change against the same supplier's purchase before it. */
export type ChangedPoint = PricePoint & { change: number | null };

/** Each purchase with its change since that supplier's earlier purchase (points are oldest first). */
export function withChange(points: PricePoint[]): ChangedPoint[] {
  const last = new Map<string, number>();
  return points.map((p) => {
    const change = changePercent(p.rate, last.get(p.supplierId));
    last.set(p.supplierId, p.rate);
    return { ...p, change };
  });
}

export interface SupplierStat {
  supplierId: string;
  supplierName: string;
  purchases: number;
  latest: PricePoint;
  previous: PricePoint | null;
  change: number | null;
  lowest: number;
  highest: number;
  average: number;
}

/** How each supplier's rate stands, cheapest latest rate first. */
export function supplierStats(points: PricePoint[]): SupplierStat[] {
  const bySupplier = new Map<string, PricePoint[]>();
  for (const p of points) bySupplier.set(p.supplierId, [...(bySupplier.get(p.supplierId) ?? []), p]);
  return [...bySupplier.values()].map((list): SupplierStat => {
    const latest = list[list.length - 1]!;
    const previous = list.length > 1 ? list[list.length - 2]! : null;
    const rates = list.map((p) => p.rate);
    return {
      supplierId: latest.supplierId, supplierName: latest.supplierName, purchases: list.length, latest, previous,
      change: changePercent(latest.rate, previous?.rate),
      lowest: Math.min(...rates), highest: Math.max(...rates), average: round2(rates.reduce((s, r) => s + r, 0) / rates.length),
    };
  }).sort((a, b) => a.latest.rate - b.latest.rate || a.supplierName.localeCompare(b.supplierName));
}

/** What was charged against what was paid, per kg in rupees: positive is a gain. Null without a rupee selling price. */
export function gapOf(point: PricePoint): { amount: number; percent: number } | null {
  const sold = point.sale?.rateInr;
  if (sold === null || sold === undefined || point.rate <= 0) return null;
  return { amount: round2(sold - point.rate), percent: round2(((sold - point.rate) / point.rate) * 100) };
}

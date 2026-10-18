/** Rates are picked from multiples of this (6.00, 6.25, 6.50 ...). */
export const RATE_STEP = 0.25;
/** ...and stay within this much of the average rate, so no line is far from the others. */
export const RATE_BAND = 1;

const EXHAUSTIVE_LIMIT = 400_000;

export interface FitLine {
  /** Total nett weight of the line (nett per package x boxes). */
  kg: number;
  /** The rate the line has now; used to keep dearer products dearer. */
  rate: number;
}

export interface FitResult {
  rates: number[];
  /** Index of the line that got an odd rate to close the last gap, or -1 when round rates were enough. */
  oddIndex: number;
}

/** "12,000.00", "USD 12000", " 1 200.5 " -> number; NaN when there is no number in it. */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/[^0-9.,]/g, '');
  if (!cleaned) return NaN;
  // a lone comma followed by 1-2 digits is a decimal comma ("12,5"); otherwise commas are thousands separators
  const asDecimalComma = /^\d+,\d{1,2}$/.test(cleaned);
  return Number(asDecimalComma ? cleaned.replace(',', '.') : cleaned.replace(/,/g, ''));
}

const round4 = (v: number) => Math.round(v * 10000) / 10000;
const onStep = (v: number) => Math.round(v / RATE_STEP) * RATE_STEP;

/**
 * Sets a rate per kg for every line so the invoice adds up to `target`.
 * Rates are round values (multiples of 0.25) close to the average rate; the combination nearest the target wins,
 * and among equals the one that keeps each product's old price order. Whatever is left over goes on the biggest line.
 * Lines without weight are left alone. Returns null when there is nothing to fit.
 */
export function fitRatesToTotal(lines: FitLine[], target: number): FitResult | null {
  const active = lines.map((l, i) => ({ ...l, i })).filter((l) => l.kg > 0);
  const totalKg = active.reduce((s, l) => s + l.kg, 0);
  if (!(target > 0) || totalKg <= 0) return null;

  const mean = target / totalKg;
  const low = Math.max(RATE_STEP, onStep(mean - RATE_BAND));
  const high = Math.max(low, onStep(mean + RATE_BAND));
  const grid: number[] = [];
  for (let v = low; v <= high + 1e-9; v += RATE_STEP) grid.push(round4(v));

  const oldTotal = active.reduce((s, l) => s + l.kg * l.rate, 0);
  // what each line would cost if the old prices were scaled to the target: the tie-breaker
  const wanted = active.map((l) => (oldTotal > 0 ? (l.rate * target) / oldTotal : mean));
  const deviation = (pick: number[]) => pick.reduce((s, v, j) => s + Math.abs(v - wanted[j]!), 0);
  const gap = (pick: number[]) => Math.abs(target - pick.reduce((s, v, j) => s + v * active[j]!.kg, 0));
  const better = (a: number[], b: number[] | null) => {
    if (!b) return true;
    const da = gap(a); const db = gap(b);
    return da < db - 1e-6 || (Math.abs(da - db) < 1e-6 && deviation(a) < deviation(b) - 1e-9);
  };

  let best: number[] | null = null;
  if (grid.length ** active.length <= EXHAUSTIVE_LIMIT) {
    const pick: number[] = [];
    const go = (j: number) => {
      if (j === active.length) { if (better(pick, best)) best = pick.slice(); return; }
      for (const v of grid) { pick[j] = v; go(j + 1); }
    };
    go(0);
  } else {
    // many lines: start every line at the average and nudge one line a step at a time while it gets closer
    let pick = active.map((_, j) => grid.reduce((a, v) => (Math.abs(v - wanted[j]!) < Math.abs(a - wanted[j]!) ? v : a), grid[0]!));
    for (let improved = true; improved;) {
      improved = false;
      for (let j = 0; j < pick.length; j++) {
        for (const delta of [RATE_STEP, -RATE_STEP]) {
          const next = pick.slice();
          next[j] = round4(next[j]! + delta);
          if (next[j]! >= low - 1e-9 && next[j]! <= high + 1e-9 && better(next, pick)) { pick = next; improved = true; }
        }
      }
    }
    best = pick;
  }

  const rates = lines.map((l) => l.rate);
  active.forEach((l, j) => { rates[l.i] = best![j]!; });

  const left = target - active.reduce((s, l, j) => s + l.kg * best![j]!, 0);
  let oddIndex = -1;
  if (Math.abs(left) >= 0.005) {
    const big = active.reduce((a, l) => (l.kg > a.kg ? l : a), active[0]!);
    const adjusted = round4(rates[big.i]! + left / big.kg);
    if (adjusted > 0) { rates[big.i] = adjusted; oddIndex = big.i; }
  }
  return { rates, oddIndex };
}

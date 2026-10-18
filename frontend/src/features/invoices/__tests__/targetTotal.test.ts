import { describe, expect, it } from 'vitest';
import { fitRatesToTotal, parseAmount, RATE_BAND, RATE_STEP } from '../utils/targetTotal';

const total = (lines: { kg: number }[], rates: number[]) => lines.reduce((s, l, i) => s + l.kg * rates[i]!, 0);
const isRound = (v: number) => Math.abs(v / RATE_STEP - Math.round(v / RATE_STEP)) < 1e-9;

describe('parseAmount', () => {
  it('reads pasted totals', () => {
    expect(parseAmount('12,000.00')).toBe(12000);
    expect(parseAmount('USD 12000')).toBe(12000);
    expect(parseAmount(' 1,234,567.5 ')).toBe(1234567.5);
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('abc')).toBeNaN();
  });
});

describe('fitRatesToTotal', () => {
  const lines = [{ kg: 1000, rate: 6.5 }, { kg: 600, rate: 4.2 }, { kg: 480, rate: 2.8 }, { kg: 320, rate: 3.1 }];

  it('reaches the target, with round rates close to the average', () => {
    const result = fitRatesToTotal(lines, 25000)!;
    expect(total(lines, result.rates)).toBeCloseTo(25000, 1);
    const mean = 25000 / 2400;
    result.rates.forEach((r, i) => {
      if (i !== result.oddIndex) expect(isRound(r)).toBe(true);
      expect(Math.abs(r - mean)).toBeLessThanOrEqual(RATE_BAND + 0.25);
    });
  });

  it('keeps dearer products dearer', () => {
    const result = fitRatesToTotal(lines, 25000)!;
    expect(result.rates[0]!).toBeGreaterThanOrEqual(result.rates[2]!);
  });

  it('uses only round rates when they add up exactly', () => {
    const two = [{ kg: 100, rate: 7 }, { kg: 100, rate: 6 }];
    const result = fitRatesToTotal(two, 1300)!;
    expect(result.oddIndex).toBe(-1);
    expect(total(two, result.rates)).toBe(1300);
    result.rates.forEach((r) => expect(isRound(r)).toBe(true));
  });

  it('puts the leftover on the biggest line only', () => {
    const result = fitRatesToTotal(lines, 24999.99)!;
    expect(result.oddIndex).toBe(0);
    expect(total(lines, result.rates)).toBeCloseTo(24999.99, 1);
  });

  it('leaves lines without weight alone', () => {
    const withEmpty = [{ kg: 0, rate: 9 }, { kg: 500, rate: 5 }];
    const result = fitRatesToTotal(withEmpty, 3000)!;
    expect(result.rates[0]).toBe(9);
    expect(total(withEmpty, result.rates)).toBeCloseTo(3000, 2);
  });

  it('handles many lines', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ kg: 100 + i * 20, rate: 5 + (i % 3) }));
    const kg = many.reduce((s, l) => s + l.kg, 0);
    const result = fitRatesToTotal(many, 9000)!;
    expect(total(many, result.rates)).toBeCloseTo(9000, 1);
    result.rates.forEach((r) => expect(Math.abs(r - 9000 / kg)).toBeLessThanOrEqual(RATE_BAND + 0.5));
  });

  it('does nothing without a target or any weight', () => {
    expect(fitRatesToTotal(lines, 0)).toBeNull();
    expect(fitRatesToTotal([{ kg: 0, rate: 1 }], 100)).toBeNull();
  });
});

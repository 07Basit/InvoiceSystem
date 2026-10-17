import { describe, expect, it } from 'vitest';
import { fitFontSize } from '../fitText';

describe('fitFontSize', () => {
  it('scales with the container width and the length of the text', () => {
    // 14 characters * 0.58em = 8.12em, so a 150px container allows about 18.5px
    expect(fitFontSize('₹25,673,487.03')).toBe('max(0.75rem, min(1.5rem, calc(100cqw / 8.12)))');
    // a short value gets a much bigger allowance, so it stays at the normal 1.5rem in most cards
    expect(fitFontSize('55')).toBe('max(0.75rem, min(1.5rem, calc(100cqw / 1.16)))');
  });

  it('gives longer text a smaller allowance than shorter text', () => {
    const divisor = (s: string) => Number(/100cqw \/ ([\d.]+)/.exec(fitFontSize(s))![1]);
    expect(divisor('₹25,673,487.03')).toBeGreaterThan(divisor('₹3.71M'));
    expect(divisor('₹3.71M')).toBeGreaterThan(divisor('55'));
  });

  it('never goes above the largest or below the smallest size', () => {
    const css = fitFontSize('9');
    expect(css.startsWith('max(0.75rem, min(1.5rem,')).toBe(true);
    expect(fitFontSize('x', { maxRem: 2, minRem: 1 }).startsWith('max(1rem, min(2rem,')).toBe(true);
  });

  it('copes with empty text', () => {
    expect(fitFontSize('')).toContain('calc(100cqw / 0.58)');
  });
});

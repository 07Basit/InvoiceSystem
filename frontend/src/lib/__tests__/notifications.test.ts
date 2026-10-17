import { describe, expect, it } from 'vitest';
import { categoryLabel, formatDateTime, timeAgo, typeStyle } from '../notifications';

const NOW = new Date('2026-10-17T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HR = 60 * MIN;
const DAY = 24 * HR;

describe('timeAgo', () => {
  it('says "just now" for the first moments', () => {
    expect(timeAgo(ago(0), NOW)).toBe('just now');
    expect(timeAgo(ago(30_000), NOW)).toBe('just now');
  });

  it('counts minutes, hours and days', () => {
    expect(timeAgo(ago(60_000), NOW)).toBe('1m ago');
    expect(timeAgo(ago(59 * MIN), NOW)).toBe('59m ago');
    expect(timeAgo(ago(2 * HR), NOW)).toBe('2h ago');
    expect(timeAgo(ago(23 * HR), NOW)).toBe('23h ago');
    expect(timeAgo(ago(3 * DAY), NOW)).toBe('3d ago');
  });

  it('switches to the date after a week', () => {
    expect(timeAgo(ago(10 * DAY), NOW)).toBe('Oct 7, 2026');
  });

  it('never shows a negative time for a clock slightly ahead, and ignores bad input', () => {
    expect(timeAgo(new Date(NOW + 5 * MIN).toISOString(), NOW)).toBe('just now');
    expect(timeAgo('not a date', NOW)).toBe('');
  });
});

describe('formatDateTime', () => {
  it('shows date and time, and nothing for bad input', () => {
    expect(formatDateTime('2026-10-17T14:05:00')).toMatch(/Oct 17, 2026.*2:05 PM/);
    expect(formatDateTime('nope')).toBe('');
  });
});

describe('styles and labels', () => {
  it('has a style for every notification type and a label for every category', () => {
    for (const type of ['success', 'info', 'warning', 'error'] as const) {
      expect(typeStyle[type].label).toBeTruthy();
      expect(typeStyle[type].icon).toBeTruthy();
    }
    expect(categoryLabel).toEqual({ invoice: 'Invoices', importer: 'Importers', currency: 'Currency', system: 'System' });
  });
});

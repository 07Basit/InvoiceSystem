import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { PAGE_SIZE_ONE_COLUMN, PAGE_SIZE_TWO_COLUMNS, pageItems, usePageSize } from '../pagination';
import { useDebouncedValue } from '../useDebouncedValue';

describe('page sizes', () => {
  it('uses 10 on one column and 12 (six full rows) on two', () => {
    expect(PAGE_SIZE_ONE_COLUMN).toBe(10);
    expect(PAGE_SIZE_TWO_COLUMNS).toBe(12);
    expect(PAGE_SIZE_TWO_COLUMNS % 2).toBe(0); // no half-empty last row in a 2-column grid
  });
});

describe('pageItems', () => {
  it('lists every page when there are few', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses the middle with gaps once there are many', () => {
    expect(pageItems(1, 10)).toEqual([1, 2, 3, 4, '…', 10]);
    expect(pageItems(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]);
    expect(pageItems(10, 10)).toEqual([1, '…', 7, 8, 9, 10]);
  });

  it('does not show a gap for a single missing page', () => {
    expect(pageItems(4, 9)).toEqual([1, 2, 3, 4, 5, '…', 9]);
  });

  it('always includes first, last and the current page', () => {
    for (let total = 8; total <= 30; total++) {
      for (let page = 1; page <= total; page++) {
        const items = pageItems(page, total);
        expect(items).toContain(1);
        expect(items).toContain(total);
        expect(items).toContain(page);
      }
    }
  });
});

describe('usePageSize', () => {
  const original = window.matchMedia;
  afterEach(() => { window.matchMedia = original; });

  const mockMatchMedia = (initiallyWide: boolean) => {
    let wide = initiallyWide;
    const listeners = new Set<() => void>();
    window.matchMedia = vi.fn().mockImplementation(() => ({
      get matches() { return wide; },
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    })) as never;
    return { resize: (w: boolean) => { wide = w; listeners.forEach((cb) => cb()); } };
  };

  it('gives 10 on a narrow screen and 12 on a wide one, and follows a resize', () => {
    const screen = mockMatchMedia(false);
    const { result } = renderHook(() => usePageSize(1024));
    expect(result.current).toBe(10);
    act(() => screen.resize(true));
    expect(result.current).toBe(12);
    act(() => screen.resize(false));
    expect(result.current).toBe(10);
  });

  it('asks about the width it was given', () => {
    mockMatchMedia(true);
    renderHook(() => usePageSize(1280));
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1280px)');
  });

  it('falls back to the one-column size when the browser cannot report widths', () => {
    // @ts-expect-error simulate an environment without matchMedia
    window.matchMedia = undefined;
    const { result } = renderHook(() => usePageSize(1024));
    expect(result.current).toBe(10);
  });
});

describe('useDebouncedValue', () => {
  it('only updates after the value has stopped changing', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } });
    rerender({ v: 'ab' });
    rerender({ v: 'abc' });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current).toBe('abc');
    vi.useRealTimers();
  });
});

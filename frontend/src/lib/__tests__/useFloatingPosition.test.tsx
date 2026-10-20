import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFloatingPosition } from '../useFloatingPosition';

const rectOf = (top: number, height = 40): DOMRect => ({ top, bottom: top + height, left: 100, right: 300, width: 200, height, x: 100, y: top, toJSON: () => ({}) });

function setup(initialTop: number, onAnchorHidden?: () => void) {
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  let top = initialTop;
  vi.spyOn(anchor, 'getBoundingClientRect').mockImplementation(() => rectOf(top));
  const ref = { current: anchor };
  const hook = renderHook(() => useFloatingPosition(true, ref, { width: 320, height: 340, ...(onAnchorHidden ? { onAnchorHidden } : {}) }));
  const scrollTo = (next: number, target: EventTarget = window) => { top = next; act(() => { target.dispatchEvent(new Event('scroll')); }); };
  return { hook, scrollTo, anchor };
}

describe('useFloatingPosition', () => {
  beforeEach(() => { Object.assign(window, { innerHeight: 800, innerWidth: 1200 }); });
  afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

  it('sits just below the field and follows it as the page scrolls', () => {
    const { hook, scrollTo } = setup(100);
    expect(hook.result.current).toMatchObject({ top: 144, left: 100 });
    scrollTo(60);
    expect(hook.result.current).toMatchObject({ top: 104 });
  });

  it('decides above or below once, so it does not jump to the other side while scrolling', () => {
    const { hook, scrollTo } = setup(700); // no room below: opens above
    expect(hook.result.current).toMatchObject({ bottom: 800 - 700 + 4 });
    expect(hook.result.current.top).toBeUndefined();
    scrollTo(100); // plenty of room below now, but it stays above
    expect(hook.result.current).toMatchObject({ bottom: 800 - 100 + 4 });
    expect(hook.result.current.top).toBeUndefined();
  });

  it("ignores scrolling inside the dropdown's own list", () => {
    const { hook, scrollTo } = setup(100);
    const popup = document.createElement('div');
    popup.setAttribute('data-floating-popup', '');
    const list = document.createElement('ul');
    popup.appendChild(list);
    document.body.appendChild(popup);
    const before = hook.result.current;
    act(() => { list.dispatchEvent(new Event('scroll', { bubbles: false })); });
    scrollTo(100, list);
    expect(hook.result.current).toBe(before);
  });

  it('asks to close when the field scrolls completely out of sight', () => {
    const onHidden = vi.fn();
    const { scrollTo } = setup(100, onHidden);
    scrollTo(-200); // bottom edge above the top of the screen
    expect(onHidden).toHaveBeenCalled();
  });
});

/** Right edge of the nearest scrolling ancestor (or the window): popovers must not poke past it. */
export function scrollParentRight(el: HTMLElement): number {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(node);
    if (/(auto|scroll|hidden)/.test(overflowX + overflowY)) return node.getBoundingClientRect().right;
  }
  return window.innerWidth;
}

/** True when a popover `width` px wide, left-aligned to `el`, would overflow its scrolling container. */
export function shouldAlignRight(el: HTMLElement, width: number): boolean {
  const rect = el.getBoundingClientRect();
  return rect.left + width > scrollParentRight(el) - 8 && rect.right - width >= 0;
}

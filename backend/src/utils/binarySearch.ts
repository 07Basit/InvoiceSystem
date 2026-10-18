/**
 * Index of the last item whose `key` is at or before `target` in a list sorted by `key` (ascending),
 * or -1 when every item is later. O(log n) instead of scanning the whole list.
 */
export function lastAtOrBefore<T>(sorted: readonly T[], target: number, key: (item: T) => number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (key(sorted[mid]!) <= target) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * The `n` items with the largest `score`, best first. Keeps a min-heap of size n, so it is
 * O(m log n) time and O(n) space for m items, instead of sorting all m.
 */
export function topN<T>(items: Iterable<T>, n: number, score: (item: T) => number): T[] {
  if (n <= 0) return [];
  const heap: Array<{ item: T; score: number }> = [];

  const siftUp = (from: number) => {
    let i = from;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent]!.score <= heap[i]!.score) break;
      [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
      i = parent;
    }
  };
  const siftDown = (from: number) => {
    let i = from;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (l < heap.length && heap[l]!.score < heap[smallest]!.score) smallest = l;
      if (r < heap.length && heap[r]!.score < heap[smallest]!.score) smallest = r;
      if (smallest === i) break;
      [heap[smallest], heap[i]] = [heap[i]!, heap[smallest]!];
      i = smallest;
    }
  };

  for (const item of items) {
    const s = score(item);
    if (heap.length < n) {
      heap.push({ item, score: s });
      siftUp(heap.length - 1);
    } else if (s > heap[0]!.score) {
      heap[0] = { item, score: s };
      siftDown(0);
    }
  }
  return heap.sort((a, b) => b.score - a.score).map((h) => h.item);
}

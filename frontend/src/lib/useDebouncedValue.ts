import { useEffect, useState } from 'react';

/** Returns `value`, but only after it has stopped changing for `delayMs` (keeps search-as-you-type from hitting the server on every key). */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

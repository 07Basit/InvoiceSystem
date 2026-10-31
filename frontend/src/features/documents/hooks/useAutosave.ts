import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

/**
 * Saves a little after the last change, and once more when the editor is left.
 * Call `markDirty()` on every change; `flush()` saves right away (the Save button).
 */
export function useAutosave(save: () => Promise<void>, delayMs = 1500) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const saveRef = useRef(save);
  saveRef.current = save;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(false);
  const saving = useRef(false);

  const flush = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    if (!dirty.current || saving.current) return;
    saving.current = true;
    dirty.current = false;
    setStatus('saving');
    try {
      await saveRef.current();
      setStatus(dirty.current ? 'unsaved' : 'saved');
    } catch {
      dirty.current = true;
      setStatus('error');
    } finally {
      saving.current = false;
      // something changed while this save was running
      if (dirty.current && status !== 'error') timer.current = setTimeout(() => void flush(), delayMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs]);

  const markDirty = useCallback(() => {
    dirty.current = true;
    setStatus((s) => (s === 'saving' ? s : 'unsaved'));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delayMs);
  }, [delayMs, flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current || saving.current) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      clearTimeout(timer.current);
      void flush(); // leaving the editor saves what is left
    };
  }, [flush]);

  return { status, markDirty, flush };
}

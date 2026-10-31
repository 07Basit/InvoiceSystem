import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions<T> {
  /** Autosave runs only while this is true (for example while a draft is open) */
  enabled: boolean;
  /** The current content. Anything that serialises to different JSON counts as a change. */
  value: T;
  save: (value: T) => Promise<unknown>;
  delayMs?: number;
}

/**
 * Saves `value` a moment after it last changed, and once more when autosave is switched off (the form is closed).
 * Nothing is saved until `arm()` is called, which is done on the person's first click or keystroke: a form that fills
 * itself in while it opens (defaults, a loaded draft) must not look like an edit. The state at that moment is the baseline.
 */
export function useAutosave<T>({ enabled, value, save, delayMs = 1500 }: UseAutosaveOptions<T>) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const valueRef = useRef(value);
  const saveRef = useRef(save);
  const lastSaved = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef(false);
  const armed = useRef(false);
  const enabledRef = useRef(enabled);

  if (enabled) valueRef.current = value; // after it is switched off, the last value while on is what gets flushed
  saveRef.current = save;
  enabledRef.current = enabled;

  const snapshot = enabled ? JSON.stringify(value) : null;

  const run = useCallback(async () => {
    clearTimeout(timer.current);
    if (saving.current || !armed.current) return;
    const current = JSON.stringify(valueRef.current);
    if (current === lastSaved.current) { setStatus((s) => (s === 'unsaved' ? 'saved' : s)); return; }
    saving.current = true;
    setStatus('saving');
    try {
      await saveRef.current(valueRef.current);
      lastSaved.current = current;
      setSavedAt(new Date());
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      saving.current = false;
      // it changed again while saving
      if (enabledRef.current && armed.current && JSON.stringify(valueRef.current) !== lastSaved.current && status !== 'error') timer.current = setTimeout(() => void run(), delayMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs]);

  /** The person has started working in the form: what is on screen now is the saved state. */
  const arm = useCallback(() => {
    if (armed.current || !enabledRef.current) return;
    armed.current = true;
    lastSaved.current = JSON.stringify(valueRef.current);
  }, []);

  /** A save made some other way (the Save Draft button) already stored the current content. */
  const markSaved = useCallback(() => {
    if (!enabledRef.current) return;
    clearTimeout(timer.current);
    lastSaved.current = JSON.stringify(valueRef.current);
    setSavedAt(new Date());
    setStatus('saved');
  }, []);

  // switched off: nothing to show
  useEffect(() => {
    if (enabled) return;
    setStatus('idle');
    setSavedAt(null);
  }, [enabled]);

  // a change: wait for a pause, then save
  useEffect(() => {
    if (!enabled || !armed.current || snapshot === lastSaved.current) return;
    setStatus((s) => (s === 'saving' ? s : 'unsaved'));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(), delayMs);
    return () => clearTimeout(timer.current);
  }, [enabled, snapshot, delayMs, run]);

  // switched off (form closed) or left: save what is still pending, then forget everything
  useEffect(() => {
    if (!enabled) return;
    return () => {
      clearTimeout(timer.current);
      if (armed.current && JSON.stringify(valueRef.current) !== lastSaved.current) void run();
      armed.current = false;
      lastSaved.current = null;
      setStatus('idle');
      setSavedAt(null);
    };
  }, [enabled, run]);

  return { status, savedAt, arm, markSaved };
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAutosave } from '../useAutosave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = (initial: { text: string }, enabled = true, save = vi.fn().mockResolvedValue(undefined)) =>
  ({ save, ...renderHook((props: { value: { text: string }; enabled: boolean }) => useAutosave({ ...props, save, delayMs: 1000 }), { initialProps: { value: initial, enabled } }) });

const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('useAutosave', () => {
  it('does not save a form that only filled itself in, before the person has touched it', async () => {
    const { save, rerender } = setup({ text: 'a' });
    rerender({ value: { text: 'filled by a default' }, enabled: true });
    await advance(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it('saves a pause after the last change, once the person has started working', async () => {
    const { save, result, rerender } = setup({ text: 'a' });
    act(() => result.current.arm());
    rerender({ value: { text: 'ab' }, enabled: true });
    await advance(600);
    rerender({ value: { text: 'abc' }, enabled: true });
    await advance(600);
    expect(save).not.toHaveBeenCalled(); // still typing
    expect(result.current.status).toBe('unsaved');
    await advance(600);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ text: 'abc' });
    expect(result.current.status).toBe('saved');
    expect(result.current.savedAt).toBeInstanceOf(Date);
  });

  it('does not save again when nothing changed since the last save', async () => {
    const { save, result, rerender } = setup({ text: 'a' });
    act(() => result.current.arm());
    rerender({ value: { text: 'b' }, enabled: true });
    await advance(1100);
    rerender({ value: { text: 'b' }, enabled: true });
    await advance(3000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves what is pending when autosave is switched off (the form is closed)', async () => {
    const { save, result, rerender } = setup({ text: 'a' });
    act(() => result.current.arm());
    rerender({ value: { text: 'unsaved edit' }, enabled: true });
    await advance(200);
    rerender({ value: { text: 'unsaved edit' }, enabled: false });
    await advance(0);
    expect(save).toHaveBeenCalledWith({ text: 'unsaved edit' });
  });

  it('treats a save made another way as the saved state', async () => {
    const { save, result, rerender } = setup({ text: 'a' });
    act(() => result.current.arm());
    rerender({ value: { text: 'b' }, enabled: true });
    act(() => result.current.markSaved());
    await advance(3000);
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe('saved');
  });

  it('reports a failed save and tries again on the next change', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const { result, rerender } = setup({ text: 'a' }, true, save);
    act(() => result.current.arm());
    rerender({ value: { text: 'b' }, enabled: true });
    await advance(1100);
    expect(result.current.status).toBe('error');
    rerender({ value: { text: 'bc' }, enabled: true });
    await advance(1100);
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('saved');
  });

  it('shows nothing for a save made while it was switched off', async () => {
    const { result } = setup({ text: 'a' }, false);
    act(() => result.current.markSaved());
    expect(result.current.status).toBe('idle');
    expect(result.current.savedAt).toBeNull();
  });

  it('does nothing while it is switched off', async () => {
    const { save, result, rerender } = setup({ text: 'a' }, false);
    act(() => result.current.arm());
    rerender({ value: { text: 'b' }, enabled: false });
    await advance(5000);
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });
});

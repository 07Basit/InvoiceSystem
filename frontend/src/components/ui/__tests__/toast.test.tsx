import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TOAST_AFTER_HOVER_MS, TOAST_DURATION_MS, ToastProvider, useToast } from '../toast';

function Trigger({ type = 'success' as 'success' | 'error' | 'info', title = 'Saved', message }: { type?: 'success' | 'error' | 'info'; title?: string; message?: string }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(title, message, type)}>show</button>;
}

const setup = (props: Parameters<typeof Trigger>[0] = {}) => {
  render(<ToastProvider><Trigger {...props} /></ToastProvider>);
  return () => fireEvent.click(screen.getByText('show'));
};
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('Toast', () => {
  it('stays long enough to read (well over the old 1 second) and then disappears', () => {
    expect(TOAST_DURATION_MS.success).toBeGreaterThanOrEqual(4000);
    const show = setup({ title: 'Invoice saved', message: 'INV-1 was created' });
    show();
    expect(screen.getByText('Invoice saved')).toBeInTheDocument();
    expect(screen.getByText('INV-1 was created')).toBeInTheDocument();

    tick(TOAST_DURATION_MS.success - 100);
    expect(screen.getByText('Invoice saved')).toBeInTheDocument();
    tick(200);
    expect(screen.queryByText('Invoice saved')).not.toBeInTheDocument();
  });

  it('keeps errors on screen longer than successes, and announces them as alerts', () => {
    expect(TOAST_DURATION_MS.error).toBeGreaterThan(TOAST_DURATION_MS.success);
    const show = setup({ type: 'error', title: 'Could not save' });
    show();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    tick(TOAST_DURATION_MS.success + 500);
    expect(screen.getByText('Could not save')).toBeInTheDocument();
    tick(TOAST_DURATION_MS.error);
    expect(screen.queryByText('Could not save')).not.toBeInTheDocument();
  });

  it('pauses while the pointer is over it, then gives a short grace period', () => {
    const show = setup({ title: 'Hover me' });
    show();
    const card = screen.getByRole('status');

    tick(TOAST_DURATION_MS.success - 500);
    fireEvent.mouseEnter(card);
    tick(60_000); // far longer than the timeout
    expect(screen.getByText('Hover me')).toBeInTheDocument();

    fireEvent.mouseLeave(card);
    tick(TOAST_AFTER_HOVER_MS - 100);
    expect(screen.getByText('Hover me')).toBeInTheDocument();
    tick(200);
    expect(screen.queryByText('Hover me')).not.toBeInTheDocument();
  });

  it('can be dismissed with the close button', () => {
    const show = setup({ title: 'Dismiss me' });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  it('shows at most four toasts at once, dropping the oldest', () => {
    const show = setup({ title: 'Toast' });
    for (let i = 0; i < 6; i++) show();
    expect(screen.getAllByRole('status')).toHaveLength(4);
  });
});

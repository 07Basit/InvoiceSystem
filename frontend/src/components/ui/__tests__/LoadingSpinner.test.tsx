import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoadingSpinner, { SLOW_AFTER_SECONDS, VERY_SLOW_AFTER_SECONDS } from '../LoadingSpinner';
import type { LoaderVariant } from '../LoaderScenes';

describe('LoadingSpinner', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('announces itself as a loading status', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('shows the message under the spinner', () => {
    render(<LoadingSpinner message="Loading invoices…" />);
    expect(screen.getByText('Loading invoices…')).toBeInTheDocument();
  });

  it('full screen: names the app and explains a slow start once the wait gets long', () => {
    render(<LoadingSpinner fullScreen />);
    expect(screen.getByText('InvoiceManager')).toBeInTheDocument();
    expect(screen.getByText('Loading your workspace…')).toBeInTheDocument();
    expect(screen.queryByText(/Waking up the server/)).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(SLOW_AFTER_SECONDS * 1000 + 50); });
    expect(screen.getByText(/Waking up the server/)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime((VERY_SLOW_AFTER_SECONDS - SLOW_AFTER_SECONDS) * 1000); });
    expect(screen.getByText(/Still working on it/)).toBeInTheDocument();
  });

  it('inline: explains a slow start too, but not for the tiny size used inside buttons', () => {
    const { rerender } = render(<LoadingSpinner />);
    act(() => { vi.advanceTimersByTime(SLOW_AFTER_SECONDS * 1000 + 50); });
    expect(screen.getByText(/Waking up the server/)).toBeInTheDocument();
    rerender(<LoadingSpinner size="sm" />);
    expect(screen.queryByText(/Waking up the server/)).not.toBeInTheDocument();
  });

  it('has a message of its own for each kind of page, which a custom message replaces', () => {
    const { rerender } = render(<LoadingSpinner variant="invoices" />);
    expect(screen.getByText('Fetching your invoices…')).toBeInTheDocument();
    rerender(<LoadingSpinner variant="dashboard" />);
    expect(screen.getByText('Crunching your numbers…')).toBeInTheDocument();
    rerender(<LoadingSpinner variant="exporter" message="Loading bank accounts…" />);
    expect(screen.getByText('Loading bank accounts…')).toBeInTheDocument();
    expect(screen.queryByText('Loading exporter details…')).not.toBeInTheDocument();
  });

  it('draws a different picture for each kind of page', () => {
    const picture = (variant: LoaderVariant) => {
      const { container, unmount } = render(<LoadingSpinner variant={variant} />);
      const html = container.querySelector('svg')?.innerHTML ?? '';
      unmount();
      return html;
    };
    const variants = ['app', 'dashboard', 'invoices', 'invoice', 'importers', 'exporter', 'products', 'recycle', 'notifications'] as const;
    const pictures = variants.map(picture);
    expect(new Set(pictures).size).toBe(variants.length);
  });

  it('the small ring has no message unless one is given', () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    expect(container.querySelector('p')).toBeNull();
  });
});

import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScrollToTop from '../ScrollToTop';

function Harness({ threshold }: { threshold?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={ref} data-testid="scroller" style={{ height: 100, overflow: 'auto' }} />
      <ScrollToTop targetRef={ref} {...(threshold ? { threshold } : {})} />
    </>
  );
}

const scrollTo = (el: HTMLElement, top: number) => {
  el.scrollTop = top;
  act(() => { fireEvent.scroll(el); });
};

const wrapperOf = () => screen.getByLabelText('Scroll to top', { selector: 'button' }).closest('[aria-hidden]')!;

describe('ScrollToTop', () => {
  it('is hidden at the top of the page and appears once you scroll down', () => {
    render(<Harness />);
    const scroller = screen.getByTestId('scroller');
    expect(wrapperOf()).toHaveAttribute('aria-hidden', 'true');

    scrollTo(scroller, 200); // below the 400px threshold
    expect(wrapperOf()).toHaveAttribute('aria-hidden', 'true');

    scrollTo(scroller, 600);
    expect(wrapperOf()).toHaveAttribute('aria-hidden', 'false');

    scrollTo(scroller, 0);
    expect(wrapperOf()).toHaveAttribute('aria-hidden', 'true');
  });

  it('respects a custom threshold', () => {
    render(<Harness threshold={50} />);
    scrollTo(screen.getByTestId('scroller'), 80);
    expect(wrapperOf()).toHaveAttribute('aria-hidden', 'false');
  });

  it('scrolls the page area back to the top when clicked', async () => {
    render(<Harness />);
    const scroller = screen.getByTestId('scroller');
    const spy = vi.fn();
    scroller.scrollTo = spy as never;
    scrollTo(scroller, 900);

    await userEvent.click(screen.getByLabelText('Scroll to top', { selector: 'button' }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it('labels the button with a "Back to top" tooltip shown above it', () => {
    render(<Harness />);
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip).toHaveTextContent('Back to top');
    expect(tip.className).toContain('bottom-full');
  });
});

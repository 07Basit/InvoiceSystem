import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from '../Pagination';

const setup = (over: Partial<Parameters<typeof Pagination>[0]> = {}) => {
  const onPageChange = vi.fn();
  render(<Pagination page={2} totalPages={5} total={55} pageSize={12} onPageChange={onPageChange} noun="invoices" {...over} />);
  return { onPageChange, user: userEvent.setup() };
};

describe('Pagination', () => {
  it('shows nothing when everything fits on one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} total={8} pageSize={12} onPageChange={() => {}} noun="invoices" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says which items are showing', () => {
    setup();
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 13–24 of 55 invoices');
  });

  it('shortens the range on the last page', () => {
    setup({ page: 5 });
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 49–55 of 55 invoices');
  });

  it('marks the current page and links to the others', async () => {
    const { user, onPageChange } = setup();
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Page 4' }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('goes to the previous and next page', async () => {
    const { user, onPageChange } = setup();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('disables Previous on the first page and Next on the last', () => {
    setup({ page: 1 });
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('disables Next on the last page', () => {
    setup({ page: 5 });
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('does not re-request the page you are already on', async () => {
    const { user, onPageChange } = setup();
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('has a compact "Page x of y" label for phones', () => {
    setup();
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
  });

  it('collapses long page lists with gaps', () => {
    setup({ page: 5, totalPages: 12, total: 140 });
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Page 12' })).toBeInTheDocument();
  });
});

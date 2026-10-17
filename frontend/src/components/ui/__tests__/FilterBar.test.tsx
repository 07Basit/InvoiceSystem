import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterBar from '../FilterBar';

const setup = (over: Partial<Parameters<typeof FilterBar>[0]> = {}) => {
  const onSearchChange = vi.fn();
  const onClear = vi.fn();
  render(
    <FilterBar search="" onSearchChange={onSearchChange} searchPlaceholder="Search things" searchLabel="Search things"
      activeCount={0} onClear={onClear} {...over}>
      <p>panel content</p>
    </FilterBar>,
  );
  return { onSearchChange, onClear, user: userEvent.setup() };
};

describe('FilterBar', () => {
  it('keeps the filters hidden until the Filters button is pressed, and hides them again', async () => {
    const { user } = setup();
    expect(screen.queryByText('panel content')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Filters/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(screen.getByText('panel content')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');

    await user.click(button);
    expect(screen.queryByText('panel content')).not.toBeInTheDocument();
  });

  it('stays closed on load even when filters are set, but shows how many on the button', () => {
    setup({ activeCount: 3 });
    expect(screen.queryByText('panel content')).not.toBeInTheDocument();
    expect(screen.getByLabelText('3 active')).toHaveTextContent('3');
  });

  it('closes when you click elsewhere or press Escape', async () => {
    const { user } = setup();
    const button = screen.getByRole('button', { name: /Filters/ });

    await user.click(button);
    expect(screen.getByText('panel content')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByText('panel content')).not.toBeInTheDocument();

    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByText('panel content')).not.toBeInTheDocument();
  });

  it('keeps the panel open while you use what is inside it', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    await user.click(screen.getByText('panel content'));
    expect(screen.getByText('panel content')).toBeInTheDocument();
  });

  it('drops the panel under the Filters button, as wide as its content, anchored right', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const panel = document.getElementById('filter-panel')!;
    expect(panel.className).toContain('absolute');
    expect(panel.className).toContain('right-0');
    expect(panel.className).toContain('w-max');
  });

  it('shows no badge when nothing is set', () => {
    setup();
    expect(screen.queryByLabelText(/active/)).not.toBeInTheDocument();
  });

  it('only offers "Clear search and filters" when there is something to clear', async () => {
    const first = setup();
    await first.user.click(screen.getByRole('button', { name: /Filters/ }));
    expect(screen.queryByText(/Clear search and filters/)).not.toBeInTheDocument();
  });

  it('clears everything from the panel', async () => {
    const { user, onClear } = setup({ activeCount: 1 });
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    await user.click(screen.getByText(/Clear search and filters/));
    expect(onClear).toHaveBeenCalled();
  });

  it('reports typing in the search box and can clear it with the X', async () => {
    const { user, onSearchChange } = setup({ search: 'abc' });
    await user.type(screen.getByLabelText('Search things'), 'd');
    expect(onSearchChange).toHaveBeenCalled();
    await user.click(screen.getByLabelText('Clear search'));
    expect(onSearchChange).toHaveBeenLastCalledWith('');
  });
});

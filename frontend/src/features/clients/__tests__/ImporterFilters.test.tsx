import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImporterFilters from '../components/ImporterFilters';

const setup = (over: Partial<Parameters<typeof ImporterFilters>[0]> = {}) => {
  const onQueryChange = vi.fn();
  const onStatusChange = vi.fn();
  render(
    <ImporterFilters query="" onQueryChange={onQueryChange} status="all" onStatusChange={onStatusChange}
      counts={{ all: 9, active: 7, inactive: 2 }} {...over} />,
  );
  return { onQueryChange, onStatusChange, user: userEvent.setup() };
};

describe('ImporterFilters', () => {
  it('shows each status with its count and marks the selected one', async () => {
    const { user } = setup({ status: 'active' });
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    expect(screen.getByRole('button', { name: /All\s*9/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Active\s*7/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Inactive\s*2/ })).toBeInTheDocument();
  });

  it('keeps the status switch inside a Filters panel that opens on demand', async () => {
    const { onStatusChange, user } = setup();
    expect(screen.queryByRole('group', { name: 'Filter by status' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    expect(screen.getByRole('group', { name: 'Filter by status' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Inactive/ }));
    expect(onStatusChange).toHaveBeenCalledWith('inactive');
  });

  it('reports typing, and offers a clear button once there is text', async () => {
    const { onQueryChange, user } = setup();
    await user.type(screen.getByLabelText('Search importers'), 'a');
    expect(onQueryChange).toHaveBeenCalledWith('a');
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('clears the search with the X button', async () => {
    const { onQueryChange, user } = setup({ query: 'maple' });
    await user.click(screen.getByLabelText('Clear search'));
    expect(onQueryChange).toHaveBeenCalledWith('');
  });
});

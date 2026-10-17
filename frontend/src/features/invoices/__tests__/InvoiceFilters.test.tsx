import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoiceFilters from '../components/InvoiceFilters';

const none = { year: '', month: '', importerId: '', currency: '' };

const setup = (over: Partial<Parameters<typeof InvoiceFilters>[0]> = {}) => {
  const handlers = { onSearchChange: vi.fn(), onFilterChange: vi.fn(), onClear: vi.fn() };
  render(
    <InvoiceFilters
      search="" filters={none} years={[2026, 2025]} currencies={['AED', 'CAD', 'USD']}
      importers={[{ id: 'i1', name: 'North Maple Foods' }, { id: 'i2', name: 'Old Co', isActive: false }]}
      {...handlers} {...over}
    />,
  );
  return { ...handlers, user: userEvent.setup() };
};

const openPanel = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: /Filters/ }));

describe('InvoiceFilters', () => {
  it('hides the four dropdowns behind one Filters button, set to "All" when opened', async () => {
    const { user } = setup();
    expect(screen.queryByRole('combobox', { name: 'Year' })).not.toBeInTheDocument();
    await openPanel(user);
    expect(screen.getByRole('combobox', { name: 'Year' })).toHaveTextContent('All years');
    expect(screen.getByRole('combobox', { name: 'Month' })).toHaveTextContent('All months');
    expect(screen.getByRole('combobox', { name: 'Importer' })).toHaveTextContent('All importers');
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('All currencies');
    expect(screen.queryByRole('button', { name: /Clear search and filters/ })).not.toBeInTheDocument();
  });

  it('offers only the years and currencies that exist', async () => {
    const { user } = setup();
    await openPanel(user);
    await user.click(screen.getByRole('combobox', { name: 'Year' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['All years', '2026', '2025']);
  });

  it('reports a chosen month as its number', async () => {
    const { user, onFilterChange } = setup();
    await openPanel(user);
    await user.click(screen.getByRole('combobox', { name: 'Month' }));
    await user.click(screen.getByRole('option', { name: /October/ }));
    expect(onFilterChange).toHaveBeenCalledWith('month', '10');
  });

  it('finds an importer by typing and marks inactive ones', async () => {
    const { user, onFilterChange } = setup();
    await openPanel(user);
    await user.click(screen.getByRole('combobox', { name: 'Importer' }));
    expect(screen.getByRole('option', { name: /Old Co/ })).toHaveTextContent('not needed');
    await user.type(screen.getByLabelText('Search Importer'), 'maple');
    await user.click(screen.getByRole('option', { name: /North Maple Foods/ }));
    expect(onFilterChange).toHaveBeenCalledWith('importerId', 'i1');
  });

  it('picks a currency by code', async () => {
    const { user, onFilterChange } = setup();
    await openPanel(user);
    await user.click(screen.getByRole('combobox', { name: 'Currency' }));
    await user.type(screen.getByLabelText('Search Currency'), 'aed{Enter}');
    expect(onFilterChange).toHaveBeenCalledWith('currency', 'AED');
  });

  it('shows the chosen value, and a Clear button that resets everything', async () => {
    const { user, onClear } = setup({ filters: { ...none, year: '2026', currency: 'CAD' } });
    await openPanel(user);
    expect(screen.getByRole('combobox', { name: 'Year' })).toHaveTextContent('2026');
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('CAD');
    await user.click(screen.getByRole('button', { name: /Clear search and filters/ }));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows how many filters are set on the Filters button', () => {
    setup({ filters: { ...none, year: '2026', currency: 'CAD' } });
    expect(screen.getByLabelText('2 active')).toBeInTheDocument();
  });

  it('offers Clear when only the search box has text', async () => {
    const { user } = setup({ search: 'maple' });
    await openPanel(user);
    expect(screen.getByRole('button', { name: /Clear search and filters/ })).toBeInTheDocument();
  });
});

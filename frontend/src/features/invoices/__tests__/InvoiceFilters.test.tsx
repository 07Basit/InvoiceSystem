import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import InvoiceFilters from '../components/InvoiceFilters';
import ActiveFilterChips from '../components/ActiveFilterChips';
import FilterChipGroup from '../components/FilterChipGroup';
import { noFilters, type InvoiceFilterValues } from '../utils/invoiceFilters';
import type { InvoiceFilterOptions } from '../services/invoiceService';

const options: InvoiceFilterOptions = {
  years: [2026, 2025], currencies: ['AED', 'CAD', 'USD'], loadingPorts: ['BOM'], dischargePorts: ['YUL', 'YYZ'],
  countries: ['canada'], exporters: ['Blue Ocean Exports'], products: ['Banana', 'Mango'],
};
const importers = [{ id: 'i1', name: 'North Maple Foods' }, { id: 'i2', name: 'Old Co', isActive: false }];

/** The filter bar with real state, so choosing and clearing behave as on the page. */
function Harness({ onChange }: { onChange?: (f: InvoiceFilterValues) => void }) {
  const [filters, setFilters] = useState<InvoiceFilterValues>(noFilters);
  const [search, setSearch] = useState('');
  return (
    <InvoiceFilters
      search={search} onSearchChange={setSearch} filters={filters}
      onFiltersChange={(f) => { setFilters(f); onChange?.(f); }}
      options={options} importers={importers} matching={12}
    />
  );
}

const openPanel = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Filters/ }));
  return { user, panel: screen.getByRole('dialog', { name: 'Filter invoices' }) };
};

describe('InvoiceFilters panel', () => {
  it('opens a panel with every filter group, and shows the live count', async () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog', { name: 'Filter invoices' })).not.toBeInTheDocument();
    const { panel } = await openPanel();
    for (const name of ['Date', 'Importer', 'Currency', 'Year', 'Month', 'Amount', 'Route', 'Product', 'Exporter', 'Invoice type']) {
      expect(within(panel).getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    expect(within(panel).getByRole('button', { name: 'Show 12 invoices' })).toBeInTheDocument();
  });

  it('lets you tick several importers and currencies', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const { user, panel } = await openPanel();
    await user.click(within(panel).getByRole('checkbox', { name: 'North Maple Foods' }));
    await user.click(within(panel).getByRole('checkbox', { name: 'Old Co not needed' }));
    await user.click(within(panel).getByRole('checkbox', { name: 'CAD' }));
    await user.click(within(panel).getByRole('checkbox', { name: 'USD' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ importerIds: ['i1', 'i2'], currencies: ['CAD', 'USD'] }));
    await user.click(within(panel).getByRole('checkbox', { name: 'CAD' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ currencies: ['USD'] }));
  });

  it('offers only years that exist, and sets a quick date range', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const { user, panel } = await openPanel();
    await user.click(within(panel).getByRole('button', { name: /^Year/ }));
    expect(within(within(panel).getByRole('group', { name: 'Years' })).getAllByRole('checkbox').map((c) => c.textContent)).toEqual(['2026', '2025']);
    await user.click(within(panel).getByRole('button', { name: 'This year' }));
    const last = onChange.mock.calls.at(-1)![0] as InvoiceFilterValues;
    expect(last.dateFrom).toMatch(/^\d{4}-01-01$/);
    expect(last.dateTo).toMatch(/^\d{4}-12-31$/);
    await user.click(within(panel).getByRole('button', { name: 'This year' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ dateFrom: '', dateTo: '' }));
  });

  it('filters by invoice type and amount', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const { user, panel } = await openPanel();
    await user.click(within(panel).getByRole('button', { name: /^Invoice type/ }));
    await user.click(within(panel).getByRole('radio', { name: 'Actual only' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'actual' }));
    await user.click(within(panel).getByRole('button', { name: /^Amount/ }));
    await user.type(within(panel).getByRole('textbox', { name: 'Min invoice total' }), '500');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ minTotal: '500' }));
  });

  it('clears everything, and closes with Escape', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const { user, panel } = await openPanel();
    expect(within(panel).getByRole('button', { name: 'Clear all' })).toBeDisabled();
    await user.click(within(panel).getByRole('checkbox', { name: 'CAD' }));
    await user.click(within(panel).getByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenLastCalledWith(noFilters);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Filter invoices' })).not.toBeInTheDocument();
  });

  it('shows a badge with how many things are filtered', async () => {
    render(<Harness />);
    const { user, panel } = await openPanel();
    await user.click(within(panel).getByRole('checkbox', { name: 'CAD' }));
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });
});

describe('FilterChipGroup', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ value: `v${i}`, label: `Item ${i}` }));

  it('shows a few chips with "+ N more", keeps chosen ones in view, and searches', async () => {
    const user = userEvent.setup();
    render(<FilterChipGroup ariaLabel="Things" options={many} selected={['v11']} onChange={() => {}} searchable />);
    const group = screen.getByRole('group', { name: 'Things' });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(8);
    expect(within(group).getByRole('checkbox', { name: 'Item 11' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: '+ 4 more' }));
    expect(within(group).getAllByRole('checkbox')).toHaveLength(12);
    await user.type(screen.getByRole('textbox', { name: 'Search Things' }), 'item 3');
    expect(within(group).getAllByRole('checkbox').map((c) => c.textContent)).toEqual(['Item 3']);
  });

  it('says so when there is nothing to choose from', () => {
    render(<FilterChipGroup ariaLabel="Things" options={[]} selected={[]} onChange={() => {}} emptyText="Nothing yet." />);
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument();
  });
});

describe('ActiveFilterChips', () => {
  it('shows nothing without filters, and one removable chip per choice', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ActiveFilterChips filters={noFilters} onChange={onChange} importerName={() => 'x'} />);
    expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
    rerender(<ActiveFilterChips filters={{ ...noFilters, importerIds: ['i1'], currencies: ['CAD', 'USD'] }} onChange={onChange} importerName={() => 'North Maple Foods'} />);
    expect(screen.getAllByRole('listitem').map((c) => c.textContent)).toEqual(['North Maple Foods', 'CAD', 'USD']);
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter CAD' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ importerIds: ['i1'], currencies: ['USD'] }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenLastCalledWith(noFilters);
  });
});

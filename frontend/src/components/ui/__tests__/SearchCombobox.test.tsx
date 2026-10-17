import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchCombobox from '../SearchCombobox';

const options = [
  { code: 'AED', name: 'United Arab Emirates Dirham' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'USD', name: 'US Dollar' },
].map((c) => ({ value: c.code, label: c.code, description: c.name }));

const setup = (value = '', onChange = vi.fn()) => {
  render(<SearchCombobox value={value} onChange={onChange} options={options} common={[options[4]!]} ariaLabel="Currency" />);
  return { onChange, user: userEvent.setup() };
};

describe('SearchCombobox', () => {
  it('shows the placeholder, then the selected currency with its name', () => {
    setup();
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('Select');
  });

  it('shows the selected value as "CODE — Name"', () => {
    setup('INR');
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('INR — Indian Rupee');
  });

  it('narrows the list as you type a code and selects with a click', async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole('combobox', { name: 'Currency' }));
    await user.type(screen.getByLabelText('Search Currency'), 'inr');

    const rows = screen.getAllByRole('option');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('INR');

    await user.click(rows[0]!);
    expect(onChange).toHaveBeenCalledWith('INR');
  });

  it('also matches on the currency name', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('combobox', { name: 'Currency' }));
    await user.type(screen.getByLabelText('Search Currency'), 'dollar');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('CAD'), expect.stringContaining('USD')]),
    );
  });

  it('selects the highlighted match with the keyboard', async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole('combobox', { name: 'Currency' }));
    await user.type(screen.getByLabelText('Search Currency'), 'eu{Enter}');
    expect(onChange).toHaveBeenCalledWith('EUR');
  });

  it('starts a search when you type on the closed field', async () => {
    const { user } = setup();
    screen.getByRole('combobox', { name: 'Currency' }).focus();
    await user.keyboard('a');
    expect(screen.getByLabelText('Search Currency')).toHaveValue('a');
  });

  it('says so when nothing matches, and closes on Escape', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('combobox', { name: 'Currency' }));
    await user.type(screen.getByLabelText('Search Currency'), 'zzz');
    expect(screen.getByText(/No match for/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('keeps the best match highlighted when the pointer rests over the list while typing', async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole('combobox', { name: 'Currency' }));
    // pointer is already over the list, then the list re-filters underneath it
    await user.hover(screen.getAllByRole('option')[3]!);
    await user.type(screen.getByLabelText('Search Currency'), 'eur');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('EUR');
  });
});

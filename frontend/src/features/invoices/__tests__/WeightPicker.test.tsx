import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeightPicker, { COMMON_WEIGHTS } from '../components/WeightPicker';

const setup = (props: Partial<React.ComponentProps<typeof WeightPicker>> = {}) => {
  const onChange = vi.fn();
  render(<WeightPicker value={0} onChange={onChange} ariaLabel="Nett weight per package for product 1" {...props} />);
  return { onChange, user: userEvent.setup(), field: screen.getByRole('combobox', { name: 'Nett weight per package for product 1' }) };
};

describe('WeightPicker', () => {
  it('shows the weight in KGS, or a hint when it is empty', () => {
    const empty = setup();
    expect(empty.field).toHaveTextContent('Weight (KGS)');
  });

  it('shows the chosen weight with its unit', () => {
    const { field } = setup({ value: 2.5 });
    expect(field).toHaveTextContent('2.5 KGS');
  });

  it('lists the common weights in KGS and picking one sets it', async () => {
    const { onChange, user, field } = setup();
    await user.click(field);
    const rows = screen.getAllByRole('option');
    expect(rows).toHaveLength(COMMON_WEIGHTS.length);
    expect(within(rows[0]!).getByText('1 KGS')).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /^5 KGS/ }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('offers the product\'s usual weight first, even when it is not a common one', async () => {
    const { user, field } = setup({ usual: 7.5 });
    await user.click(field);
    const rows = screen.getAllByRole('option');
    expect(rows[0]).toHaveTextContent('7.5 KGS');
    expect(rows[0]).toHaveTextContent('Usual for this product');
    // not listed twice
    expect(screen.getAllByText('7.5 KGS')).toHaveLength(1);
  });

  it('accepts any weight that is typed, with up to three decimals', async () => {
    const { onChange, user, field } = setup();
    await user.click(field);
    await user.type(screen.getByLabelText('Search Nett weight per package for product 1'), '3.75');
    await user.click(screen.getByRole('option', { name: /Use “3.75”/ }));
    expect(onChange).toHaveBeenCalledWith(3.75);
  });

  it('ignores something that is not a weight', async () => {
    const { onChange, user, field } = setup();
    await user.click(field);
    await user.type(screen.getByLabelText('Search Nett weight per package for product 1'), 'abc');
    await user.click(screen.getByRole('option', { name: /Use “abc”/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

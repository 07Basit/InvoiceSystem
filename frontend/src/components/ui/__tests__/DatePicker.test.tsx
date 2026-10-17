import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DatePicker, { formatYmd, monthGrid, parseYmd } from '../DatePicker';

describe('date helpers', () => {
  it('parses and formats valid dates and rejects impossible ones', () => {
    expect(parseYmd('2026-10-17')).toEqual({ y: 2026, m: 9, d: 17 });
    expect(parseYmd('2026-02-30')).toBeNull();
    expect(parseYmd('')).toBeNull();
    expect(formatYmd('2026-10-17')).toBe('17 Oct 2026');
  });

  it('builds six whole Monday-first weeks', () => {
    const grid = monthGrid(2026, 9); // Oct 2026 starts on a Thursday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toMatchObject({ y: 2026, m: 8, d: 28, inMonth: false });
    expect(grid[3]).toMatchObject({ m: 9, d: 1, inMonth: true });
  });
});

describe('DatePicker', () => {
  it('shows the chosen date and picks another day', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-10-17" onChange={onChange} ariaLabel="Invoice Date" />);
    expect(screen.getByRole('button', { name: 'Invoice Date' })).toHaveTextContent('17 Oct 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Invoice Date' }));
    await userEvent.click(screen.getByRole('button', { name: '5 October 2026' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-05');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves between months and jumps to another year', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-10-17" onChange={onChange} ariaLabel="Invoice Date" />);
    await userEvent.click(screen.getByRole('button', { name: 'Invoice Date' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('button', { name: 'Change month or year' })).toHaveTextContent('November 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Change month or year' })); // months
    await userEvent.click(screen.getByRole('button', { name: 'Change month or year' })); // years
    await userEvent.click(screen.getByRole('button', { name: '2024' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mar' }));
    await userEvent.click(screen.getByRole('button', { name: '1 March 2024' }));
    expect(onChange).toHaveBeenCalledWith('2024-03-01');
  });

  it('closes on Escape', async () => {
    render(<DatePicker value="" onChange={() => {}} ariaLabel="Invoice Date" />);
    await userEvent.click(screen.getByRole('button', { name: 'Invoice Date' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

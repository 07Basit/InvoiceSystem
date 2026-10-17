import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Tooltip from '../Tooltip';

describe('Tooltip', () => {
  it('renders the label as a tooltip next to its trigger, revealed by hover/focus styles', () => {
    render(<Tooltip label="Delete importer"><button aria-label="Delete ABC">x</button></Tooltip>);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Delete importer');
    expect(tip.className).toContain('group-hover/tip:opacity-100');
    expect(tip.className).toContain('group-focus-within/tip:opacity-100');
    expect(screen.getByRole('button', { name: 'Delete ABC' })).toBeInTheDocument();
  });

  it('lines the bubble up with the right edge when asked', () => {
    render(<Tooltip label="Edit importer" align="end"><button>x</button></Tooltip>);
    expect(screen.getByRole('tooltip').className).toContain('right-0');
  });
});

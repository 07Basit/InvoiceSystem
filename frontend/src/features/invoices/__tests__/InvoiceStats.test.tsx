import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import InvoiceStats from '../components/InvoiceStats';

describe('InvoiceStats', () => {
  it('shows the counts, a compact total in the reporting currency and the not-in-revenue count', () => {
    render(<InvoiceStats summary={{ total: 55, thisMonth: 8, totalValue: 2567348.7, baseCurrency: 'USD', notInRevenue: 2 }} />);
    expect(screen.getByTestId('invoice-stat-total')).toHaveTextContent('55');
    expect(screen.getByTestId('invoice-stat-month')).toHaveTextContent('8');
    expect(screen.getByTestId('invoice-stat-value')).toHaveTextContent('$2.57M');
    expect(screen.getByText('Total value (USD)')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-stat-norate')).toHaveTextContent('2');
  });

  it('keeps the full amount available as a hover title', () => {
    render(<InvoiceStats summary={{ total: 1, thisMonth: 1, totalValue: 1234.5, baseCurrency: 'USD', notInRevenue: 0 }} />);
    expect(screen.getByTestId('invoice-stat-value').closest('[title]')).toHaveAttribute('title', '$1,234.50');
  });
});

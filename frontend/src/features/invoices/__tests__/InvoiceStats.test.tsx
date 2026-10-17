import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import InvoiceStats from '../components/InvoiceStats';
import type { InvoiceSummary } from '../services/invoiceService';

const summary = (over: Partial<InvoiceSummary> = {}): InvoiceSummary => ({
  total: 55, thisMonth: 8, totalValue: 25_000_000, monthValue: 2_567_348.7, baseCurrency: 'USD', notInRevenue: 2,
  years: [2026, 2025], currencies: ['CAD', 'USD'], ...over,
});

describe('InvoiceStats', () => {
  it('shows invoice counts, this month\'s revenue (not the all-time total) and the not-in-revenue count', () => {
    render(<InvoiceStats summary={summary()} />);
    expect(screen.getByTestId('invoice-stat-total')).toHaveTextContent('55');
    expect(screen.getByTestId('invoice-stat-month')).toHaveTextContent('8');
    expect(screen.getByText('Invoices this month')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-stat-value')).toHaveTextContent('$2.57M');
    expect(screen.getByTestId('invoice-stat-value')).not.toHaveTextContent('25');
    expect(screen.getByText('Revenue this month (USD)')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-stat-norate')).toHaveTextContent('2');
  });

  it('keeps the full month amount and the all-time total available as a hover title', () => {
    render(<InvoiceStats summary={summary({ monthValue: 1234.5, totalValue: 99000 })} />);
    expect(screen.getByTestId('invoice-stat-value').closest('[title]')).toHaveAttribute('title', '$1,234.50 this month. All time: $99,000.00');
  });
});

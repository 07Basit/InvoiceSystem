import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from '../Breadcrumbs';

const renderTrail = (items: Parameters<typeof Breadcrumbs>[0]['items']) =>
  render(<MemoryRouter><Breadcrumbs items={items} /></MemoryRouter>);

describe('Breadcrumbs', () => {
  it('shows Dashboard, each parent as a link, and the current page last', () => {
    renderTrail([{ label: 'Invoices', to: '/invoices' }, { label: 'INV-123' }]);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/');
    const items = within(nav).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['', 'Invoices', 'INV-123']);
    expect(within(items[1]!).getByRole('link', { name: 'Invoices' })).toHaveAttribute('href', '/invoices');
    expect(within(items[2]!).getByText('INV-123')).toHaveAttribute('aria-current', 'page');
    expect(within(items[2]!).queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps a short "back to the parent" link for small screens', () => {
    renderTrail([{ label: 'Products', to: '/products' }, { label: 'KJ Fruits' }, { label: 'Toronto' }]);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const links = within(nav).getAllByRole('link', { name: 'Products' });
    // one in the trail, one in the compact phone version
    expect(links).toHaveLength(2);
    links.forEach((l) => expect(l).toHaveAttribute('href', '/products'));
  });

  it('has no phone link when there is no parent to go to', () => {
    renderTrail([{ label: 'Somewhere' }]);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getAllByRole('link')).toHaveLength(1); // only the Dashboard home icon
  });
});

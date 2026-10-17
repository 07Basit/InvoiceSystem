import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import QuickCreateMenu from '../QuickCreateMenu';
import { pageTitleForPath } from '../TopBar';

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

const renderMenu = () => render(
  <MemoryRouter initialEntries={['/']}>
    <QuickCreateMenu />
    <Routes><Route path="*" element={<Where />} /></Routes>
  </MemoryRouter>,
);

describe('pageTitleForPath', () => {
  it('names each page', () => {
    expect(pageTitleForPath('/')).toBe('Dashboard');
    expect(pageTitleForPath('/invoices')).toBe('Invoices');
    expect(pageTitleForPath('/invoices/abc')).toBe('Invoice');
    expect(pageTitleForPath('/importers')).toBe('Importers');
    expect(pageTitleForPath('/documents')).toBe('Documents');
    expect(pageTitleForPath('/recycle-bin')).toBe('Recycle Bin');
    expect(pageTitleForPath('/profile')).toBe('My Profile');
  });
});

describe('QuickCreateMenu', () => {
  it('is closed until opened, then offers an invoice and an importer', async () => {
    renderMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /new/i }));
    expect(screen.getByRole('menuitem', { name: /new invoice/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /new importer/i })).toBeInTheDocument();
  });

  it('goes to the invoices page asking for a new invoice, and closes', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /new/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /new invoice/i }));
    expect(screen.getByTestId('where')).toHaveTextContent('/invoices?new=1');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('goes to the importers page for a new importer', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /new/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /new importer/i }));
    expect(screen.getByTestId('where')).toHaveTextContent('/importers?new=1');
  });

  it('closes on Escape', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /new/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

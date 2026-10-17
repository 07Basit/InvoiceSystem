import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DocumentsPage from '../pages/DocumentsPage';

describe('DocumentsPage', () => {
  it('only says "Coming soon" — no table, no actions', () => {
    render(<DocumentsPage />);
    expect(screen.getByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

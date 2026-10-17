import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImporterStats from '../components/ImporterStats';

describe('ImporterStats', () => {
  it('shows total, active and inactive counts', () => {
    render(<ImporterStats total={10} active={7} inactive={3} />);
    expect(screen.getByTestId('importer-stat-total')).toHaveTextContent('10');
    expect(screen.getByTestId('importer-stat-active')).toHaveTextContent('7');
    expect(screen.getByTestId('importer-stat-inactive')).toHaveTextContent('3');
    expect(screen.getByText('Total importers')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows zeros when there are no importers', () => {
    render(<ImporterStats total={0} active={0} inactive={0} />);
    expect(screen.getByTestId('importer-stat-total')).toHaveTextContent('0');
  });
});

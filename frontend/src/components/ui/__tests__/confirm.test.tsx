import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirm } from '../confirm';

function Harness({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button onClick={async () => onResult(await confirm({ title: 'Delete it?', message: 'Cannot be undone.', confirmLabel: 'Delete', destructive: true }))}>
      ask
    </button>
  );
}

const setup = () => {
  const onResult = vi.fn();
  render(<ConfirmProvider><Harness onResult={onResult} /></ConfirmProvider>);
  return { onResult, user: userEvent.setup() };
};

describe('ConfirmProvider', () => {
  it('shows the question and resolves true when confirmed', async () => {
    const { onResult, user } = setup();
    await user.click(screen.getByText('ask'));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete it?');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Cannot be undone.');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onResult).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('resolves false on Cancel, Escape and a click outside', async () => {
    const { onResult, user } = setup();

    await user.click(screen.getByText('ask'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onResult).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByText('ask'));
    await user.keyboard('{Escape}');
    expect(onResult).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByText('ask'));
    await user.click(screen.getByRole('alertdialog').parentElement!);
    expect(onResult).toHaveBeenLastCalledWith(false);
    expect(onResult).toHaveBeenCalledTimes(3);
  });

  it('falls back to window.confirm when no provider is mounted', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);
    await userEvent.click(screen.getByText('ask'));
    expect(spy).toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith(true);
    spy.mockRestore();
  });
});

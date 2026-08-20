/**
 * The machine picker.
 *
 * Three of the four states TAC-177 asks for are failure states, and each one is
 * a place where the interface can quietly hand somebody a machine that will
 * never receive their placement. So they are tested, not eyeballed.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { TMachine } from '@holistix-forge/frontend-data';

import { MachinePicker } from './machine-picker';

const machine = (overrides: Partial<TMachine> = {}): TMachine => ({
  runner_id: 'r1',
  label: 'mac-m1',
  created_at: '2026-08-01T00:00:00.000Z',
  last_seen_at: '2026-08-20T12:00:00.000Z',
  revoked_at: null,
  unavailable: null,
  ...overrides,
});

const show = (props: Partial<Parameters<typeof MachinePicker>[0]> = {}) => {
  const onPick = jest.fn();
  render(
    <MachinePicker
      open
      onOpenChange={jest.fn()}
      machines={[machine()]}
      isLoading={false}
      onPick={onPick}
      {...props}
    />
  );
  return { onPick };
};

describe('MachinePicker', () => {
  it('offers a machine that is answering', async () => {
    const { onPick } = show();

    await userEvent.click(screen.getByRole('button', { name: /mac-m1/ }));

    expect(onPick).toHaveBeenCalledWith('r1');
  });

  // The consent TAC-156 asks to be said in the UI rather than only in a
  // ticket: a machine that joins is open to the other members of the project.
  it('says that other members will be able to place services there', () => {
    show();

    expect(
      screen.getByText(/other members will be able to place services there/i)
    ).toBeInTheDocument();
  });

  it('tells someone with no machine what to run', () => {
    show({ machines: [] });

    expect(screen.getByText(/No machine is enrolled yet/i)).toBeInTheDocument();
    expect(screen.getByText('holistix-runner login')).toBeInTheDocument();
  });

  it('shows a quiet machine, refuses it, and says what to do', async () => {
    const { onPick } = show({
      machines: [machine({ unavailable: 'unreachable' })],
    });

    const button = screen.getByRole('button', { name: /mac-m1/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('holistix-runner run');

    await userEvent.click(button);
    expect(onPick).not.toHaveBeenCalled();
  });

  // Listed rather than hidden: a machine that disappears reads as one that was
  // never enrolled.
  it('shows a revoked machine and refuses it', () => {
    show({ machines: [machine({ unavailable: 'revoked' })] });

    const button = screen.getByRole('button', { name: /mac-m1/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/Disconnected/i);
  });

  it('says it is looking rather than showing an empty list', () => {
    show({ machines: [], isLoading: true });

    expect(screen.getByText(/Looking for your machines/i)).toBeInTheDocument();
    expect(screen.queryByText(/No machine is enrolled/i)).toBeNull();
  });
});

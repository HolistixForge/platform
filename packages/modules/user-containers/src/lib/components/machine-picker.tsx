import { DialogControlled } from '@holistix-forge/ui-base';
import { TMachine } from '@holistix-forge/frontend-data';

/**
 * Which of your machines this service should run on.
 *
 * A dialog and not a popover, because of what has to be said here. Placing a
 * service on a machine is not choosing a location: it is agreeing that this
 * project runs its workloads on that computer, and that **other members of the
 * project can place services there too** once the machine has joined. That is
 * the confused-deputy shape the broker guards against between tenants, pointed
 * at somebody's own laptop, and TAC-156 asks for it to be said in the interface
 * rather than only in a ticket. A sentence that size needs room.
 *
 * The list comes from Ganymede — every machine this person enrolled — and not
 * from the project's machine catalogue, which holds only machines already
 * heartbeating into this project. The first placement is what puts one there,
 * so a picker fed from the catalogue would offer nothing, forever.
 */

/** What to do about a machine that cannot be chosen. */
const unavailableReason = (machine: TMachine): string | null => {
  if (machine.unavailable === 'revoked') {
    return 'Disconnected — enrol it again to use it';
  }
  if (machine.unavailable === 'unreachable') {
    // Named as an action, not as a state. "Offline" tells somebody their
    // machine is off; this tells them the runner is not running on it, which
    // is the thing they can actually fix and the usual cause.
    return 'Not answering — run "holistix-runner run" on it';
  }
  return null;
};

export const MachinePicker = ({
  open,
  onOpenChange,
  machines,
  isLoading,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machines: TMachine[];
  isLoading: boolean;
  onPick: (machineId: string) => void;
}) => (
  <DialogControlled
    title="Run on one of your machines"
    description="This project will run this service on the machine you pick, and other members will be able to place services there too. Disconnect the runner to withdraw it."
    open={open}
    onOpenChange={onOpenChange}
  >
    {isLoading ? (
      <p>Looking for your machines…</p>
    ) : machines.length === 0 ? (
      // Not an empty list. Somebody who has never enrolled a machine is not
      // missing a row, they are missing a step, and the empty state is the
      // only place that can say which.
      <div>
        <p>No machine is enrolled yet.</p>
        <p>
          Run <code>holistix-runner login</code> on the machine you want to use,
          then come back.
        </p>
      </div>
    ) : (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {machines.map((machine) => {
          const reason = unavailableReason(machine);
          return (
            <li key={machine.runner_id} style={{ marginBottom: '8px' }}>
              <button
                type="button"
                // Present and refused, rather than absent. A machine that
                // vanishes from the list reads as "I never enrolled it"; one
                // that is there and greyed says what became of it.
                disabled={reason !== null}
                onClick={() => onPick(machine.runner_id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  cursor: reason ? 'default' : 'pointer',
                  opacity: reason ? 0.45 : 1,
                }}
              >
                <span>{machine.label}</span>
                {reason && <small> — {reason}</small>}
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </DialogControlled>
);

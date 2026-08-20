import { useQueryMachines } from '@holistix-forge/frontend-data';

import { MachinePicker } from './machine-picker';

/**
 * `MachinePicker` with the query behind it.
 *
 * Split so the dialog stays a function of its props and can be tested without
 * a query client — the states it has to get right are all failure states, and
 * they are cheap to check only while nothing has to be mocked to reach them.
 *
 * Mounted by the card **only while the dialog is open**. A hook runs whenever
 * its component is mounted, so rendering this unconditionally would poll
 * Ganymede once per card on a project with several, for a list nobody is
 * looking at.
 */
export const ConnectedMachinePicker = ({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (machineId: string) => void;
}) => {
  const { data: machines, isLoading } = useQueryMachines();

  return (
    <MachinePicker
      open={open}
      onOpenChange={onOpenChange}
      machines={machines ?? []}
      isLoading={isLoading}
      onPick={onPick}
    />
  );
};

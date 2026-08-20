/**
 * The caller's enrolled machines.
 *
 * Asked of Ganymede rather than read from the project's collab document, and
 * that is the whole point: `user-containers:machines` holds only the machines
 * whose runner already heartbeats *into this project*, and a machine's first
 * placement is what puts it there. A picker fed from the catalogue could never
 * offer a machine that had not already joined, so no machine ever would.
 */

import { TApi_Runner } from '@holistix-forge/types';
import { useQuery } from '@tanstack/react-query';
import { useApi } from './api-context';

export const machineKeys = {
  all: ['machines'] as const,
  list: () => [...machineKeys.all, 'list'] as const,
};

/**
 * How long a machine may stay quiet before it is treated as gone.
 *
 * The same 30 seconds the container watchdog uses, and deliberately the same
 * number: to somebody looking at a card, a machine that stopped answering and a
 * container that stopped answering are the same event, and two thresholds would
 * show a live container on a dead machine.
 *
 * A runner stamps `last_seen_at` on every authenticated request and polls every
 * 15 s by default, so this is two missed passes rather than one — a single slow
 * request does not make a machine disappear from under the cursor.
 */
export const MACHINE_STALE_AFTER_MS = 30_000;

/** Why a machine cannot be placed on, or `null` when it can. */
export type TMachineUnavailable = 'revoked' | 'unreachable';

export type TMachine = TApi_Runner & {
  /**
   * `null` when the machine can be chosen.
   *
   * Computed here rather than in the component so the picker and anything else
   * that asks agree — and so the rule has one test rather than a screenshot.
   */
  unavailable: TMachineUnavailable | null;
};

/**
 * Read at a fixed instant, not per row.
 *
 * `Date.now()` inside the map would move between machines in one list, which
 * cannot produce a wrong answer at 30 s but does make the function untestable
 * without freezing the clock at the right moment.
 */
export const describeMachines = (
  runners: TApi_Runner[],
  now: number
): TMachine[] =>
  runners.map((runner) => ({
    ...runner,
    unavailable: runner.revoked_at
      ? 'revoked'
      : // Never seen counts as unreachable rather than as a separate state: it
      // is a machine that enrolled and whose runner has not been started, and
      // what the person has to do about it is the same.
      !runner.last_seen_at ||
        now - new Date(runner.last_seen_at).getTime() > MACHINE_STALE_AFTER_MS
      ? 'unreachable'
      : null,
  }));

/**
 * Every machine this person has enrolled, with whether each can be placed on.
 *
 * Refetched on an interval because a machine going quiet is the thing this list
 * exists to show, and it is not an event anything pushes here. On the same 15 s
 * as a runner's own pass, so the list is at most one pass behind the truth.
 */
export const useQueryMachines = () => {
  const { ganymedeApi } = useApi();

  return useQuery({
    queryKey: machineKeys.list(),
    queryFn: () =>
      ganymedeApi.fetch({
        url: 'runners',
        method: 'GET',
      }) as Promise<{ runners: TApi_Runner[] }>,
    select: (data) => describeMachines(data.runners ?? [], Date.now()),
    refetchInterval: 15_000,
  });
};

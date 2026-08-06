/**
 * How the gateway's `/placements` route reaches the reducer.
 *
 * The route cannot build a placement itself. What a runner needs — the
 * resolved image reference, the base64 `SETTINGS` blob, and above all the
 * hosting token that is also the container's VPN password — lives on the
 * gateway in the reducer's own memory, deliberately never in the collab
 * document: that document is a CRDT replicated to every browser in the
 * project, and a token in it would be a credential handed to everyone who can
 * open the page.
 *
 * So the reducer registers itself here at load, and the route asks. The same
 * shape as `getGatewayInstances`, narrowed to one question.
 */

import { log, EPriority } from '@holistix-forge/log';

import { TRunnerPlacement } from './placement-shape';

export type TPlacementProvider = (
  project_id: string,
  machine_id: string
) => Promise<TRunnerPlacement[]>;

let provider: TPlacementProvider | null = null;

/**
 * Register the reducer that answers placements.
 *
 * One gateway process loads this module once, so in production the second call
 * never happens. Where it does — a test loading the module twice, a hot reload
 * — the replacement is deliberate and the old reducer must not keep answering:
 * it holds the previous load's `hostingTokens`, and a placement built from
 * those hands a runner a VPN password the gateway no longer accepts. So the
 * last registration wins, and it says so rather than doing it quietly.
 */
export const setPlacementProvider = (p: TPlacementProvider): void => {
  if (provider && provider !== p) {
    log(
      EPriority.Warning,
      'USER_CONTAINERS',
      'A placement provider was already registered; replacing it. ' +
        'The previous reducer will no longer answer /placements.'
    );
  }
  provider = p;
};

/** Undo a registration — for tests, and for an orderly shutdown. */
export const clearPlacementProvider = (): void => {
  provider = null;
};

export const getPlacementProvider = (): TPlacementProvider | null => provider;

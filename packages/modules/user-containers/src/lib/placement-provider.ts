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

import { TRunnerPlacement } from './placement-shape';

export type TPlacementProvider = (
  project_id: string,
  machine_id: string
) => Promise<TRunnerPlacement[]>;

let provider: TPlacementProvider | null = null;

export const setPlacementProvider = (p: TPlacementProvider): void => {
  provider = p;
};

export const getPlacementProvider = (): TPlacementProvider | null => provider;

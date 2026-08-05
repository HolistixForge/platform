import { TPlacement } from './placement';
import { TRunnerProject } from './projects';

/**
 * Ask a project's gateway what it has placed on this machine.
 *
 * The gateway filters by the machine named in the token, so this asks for
 * "mine" rather than for a list it then has to trim. A runner that could ask
 * for another machine's placements could start that machine's services on its
 * own, and the difference between those two designs is entirely in who does
 * the filtering.
 *
 * What comes back is still checked before it is acted on — see
 * `assertPlacementIsForUs`. The gateway holding one project's room and this
 * runner are two parties, and neither is the other's authority.
 */

/**
 * The container as collab state carries it, which is not yet the shape a
 * runtime can start. Turning one into a placement needs the image reference
 * resolved and the SETTINGS blob built, both of which happen platform-side.
 */
export type TRemotePlacement = TPlacement & {
  user_container_id: string;
};

export const fetchPlacements = async (
  project: TRunnerProject,
  fetchImpl: typeof fetch = fetch
): Promise<TRemotePlacement[]> => {
  const url = `https://${
    project.gateway_hostname
  }/placements?project_id=${encodeURIComponent(project.project_id)}`;

  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${project.token}` },
  });

  if (!response.ok) {
    throw new Error(
      `Could not list placements for ${project.project_name}: ${response.status} ${response.statusText}`
    );
  }

  const body = (await response.json()) as { placements?: TRemotePlacement[] };
  return body.placements ?? [];
};

import { TRunnerCredentials } from './credentials';

/**
 * Which projects this machine has been opted into, and the token for each.
 *
 * The runner asks; it is never told. A machine that has been closed for a week
 * comes back and finds out what changed in one call, and a project taken away
 * from it simply stops appearing — there is no revocation message to miss.
 *
 * The tokens are short-lived and re-minted on every poll, which is what bounds
 * the window between a project being withdrawn and this machine noticing.
 */

export type TRunnerProject = {
  project_id: string;
  project_name: string;
  organization_id: string;
  /** Where this project's gateway answers. */
  gateway_hostname: string;
  /** Speaks for this project and no other. */
  token: string;
};

export class RunnerRevoked extends Error {
  constructor() {
    super('This runner is no longer enrolled');
    this.name = 'RunnerRevoked';
  }
}

export const fetchProjects = async (
  credentials: TRunnerCredentials,
  fetchImpl: typeof fetch = fetch
): Promise<TRunnerProject[]> => {
  const response = await fetchImpl(
    `${credentials.ganymedeUrl}/runners/me/projects`,
    { headers: { authorization: `Bearer ${credentials.token}` } }
  );

  // Distinguished from every other failure because it is the one that is not a
  // fault: somebody disconnected this machine, and the loop should stop rather
  // than retry forever against a door that is now closed.
  if (response.status === 401 || response.status === 403) {
    throw new RunnerRevoked();
  }

  if (!response.ok) {
    throw new Error(
      `Could not list projects: ${response.status} ${response.statusText}`
    );
  }

  const body = (await response.json()) as { projects?: TRunnerProject[] };
  return body.projects ?? [];
};

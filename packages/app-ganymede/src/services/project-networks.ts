import { pg } from '../database/pg';
import {
  nextNetworkCidr,
  assertNetworkName,
  NetworkAllocationError,
} from './network-allocator';

export type TProjectNetwork = {
  name: string;
  cidr: string;
};

const rows = <T>(result: {
  next: () => { allRows: () => unknown[] } | undefined;
}): T[] => (result.next()?.allRows() ?? []) as T[];

/**
 * Every network a project can place services on.
 */
export const listProjectNetworks = async (
  projectId: string
): Promise<TProjectNetwork[]> => {
  const result = await pg.query(
    `SELECT name, host(network(cidr)) || '/' || masklen(cidr) AS cidr
       FROM project_networks
      WHERE project_id = $1
      ORDER BY name`,
    [projectId]
  );
  return rows<TProjectNetwork>(result);
};

/**
 * Allocate a range for a new network, or return the one it already has.
 *
 * Idempotent on purpose: a deployment that declares its networks every time it
 * runs is the normal case, and a second declaration must not consume a second
 * range.
 *
 * Concurrency is handled by the unique constraint on (organization_id, cidr)
 * rather than by locking. Two gateways allocating at the same moment can read
 * the same set of taken ranges and pick the same one; the loser's insert fails
 * and it tries again with what it now knows. Reading before writing cannot be
 * made safe on its own, so it is not relied on.
 */
export const allocateProjectNetwork = async (
  organizationId: string,
  projectId: string,
  name: string,
  createdBy: string | null,
  attemptsLeft = 5
): Promise<TProjectNetwork> => {
  assertNetworkName(name);

  const existingResult = await pg.query(
    `SELECT name, host(network(cidr)) || '/' || masklen(cidr) AS cidr
       FROM project_networks
      WHERE project_id = $1 AND name = $2`,
    [projectId, name]
  );
  const existing = rows<TProjectNetwork>(existingResult)[0];
  if (existing) return existing;

  const takenResult = await pg.query(
    `SELECT host(network(cidr)) || '/' || masklen(cidr) AS cidr
       FROM project_networks
      WHERE organization_id = $1`,
    [organizationId]
  );
  const taken = rows<{ cidr: string }>(takenResult).map((r) => r.cidr);
  const cidr = nextNetworkCidr(taken);

  try {
    await pg.query(
      `INSERT INTO project_networks
          (organization_id, project_id, name, cidr, created_by)
       VALUES ($1, $2, $3, $4::cidr, $5)`,
      [organizationId, projectId, name, cidr, createdBy]
    );
  } catch (e) {
    // Someone took this range between the read and the write. Retry with the
    // set as it now stands rather than failing the deployment: this is the
    // expected outcome of two gateways declaring networks at once, not an
    // error anyone can act on.
    if (attemptsLeft <= 1) {
      throw new NetworkAllocationError(
        `could not allocate a range for ${name}: too many concurrent allocations`
      );
    }
    return allocateProjectNetwork(
      organizationId,
      projectId,
      name,
      createdBy,
      attemptsLeft - 1
    );
  }

  return { name, cidr };
};

export { NetworkAllocationError };

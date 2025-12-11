import { pg } from './pg';
import { EPriority, log } from '@holistix-forge/log';

/**
 * Remove a gateway from the database
 * - Ends any active allocations first
 * - Deletes the gateway entry
 */
export const removeGateway = async (gatewayId: string) => {
  log(EPriority.Info, 'REMOVE_GATEWAY', `Removing gateway ${gatewayId}`);

  // Check if gateway has active allocations
  const activeCheck = await pg.query(
    'SELECT COUNT(*) as count FROM organizations_gateways WHERE gateway_id = $1 AND ended_at IS NULL',
    [gatewayId]
  );
  const activeCount = activeCheck.next()!.oneRow()['count'] as number;

  if (activeCount > 0) {
    log(
      EPriority.Warning,
      'REMOVE_GATEWAY',
      `Gateway has ${activeCount} active allocation(s), ending them first...`
    );

    // End active allocations
    await pg.query('CALL proc_organizations_gateways_stop($1)', [gatewayId]);
    log(EPriority.Info, 'REMOVE_GATEWAY', 'Active allocations ended');
  }

  // Delete gateway (CASCADE will handle organizations_gateways)
  await pg.query('DELETE FROM gateways WHERE gateway_id = $1', [gatewayId]);

  log(EPriority.Info, 'REMOVE_GATEWAY', `✅ Gateway ${gatewayId} removed from database`);
};

/**
 * Set gateway ready status
 */
export const setGatewayReady = async (gatewayId: string, ready: boolean) => {
  await pg.query('UPDATE gateways SET ready = $1 WHERE gateway_id = $2', [
    ready,
    gatewayId,
  ]);
  log(
    EPriority.Info,
    'SET_GATEWAY_READY',
    `Gateway ${gatewayId} ready set to ${ready}`
  );
};

/**
 * Get gateway ID from container name
 */
export const getGatewayIdByContainer = async (
  containerName: string
): Promise<string | null> => {
  const result = await pg.query(
    'SELECT gateway_id FROM gateways WHERE container_name = $1',
    [containerName]
  );
  const row = result.next()?.oneRow();
  return row ? (row['gateway_id'] as string) : null;
};

/**
 * Check if gateway has active allocations
 */
export const checkGatewayAllocations = async (
  gatewayId: string
): Promise<{ count: number; organizations: Array<{ organization_id: string }> }> => {
  const result = await pg.query(
    `SELECT 
      COUNT(*) as count,
      COALESCE(json_agg(json_build_object('organization_id', organization_id)), '[]'::json) as organizations
    FROM organizations_gateways 
    WHERE gateway_id = $1 AND ended_at IS NULL`,
    [gatewayId]
  );
  const row = result.next()!.oneRow();
  return {
    count: row['count'] as number,
    organizations: (row['organizations'] as Array<{ organization_id: string }>) || [],
  };
};



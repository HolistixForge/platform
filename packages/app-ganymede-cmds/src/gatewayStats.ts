import { pg } from './pg';
import { EPriority, log } from '@holistix-forge/log';

export const gatewayStats = async () => {
  const r = await pg.query('SELECT * FROM public.func_gateway_stats()', []);
  const stats = r.next()!.oneRow();

  log(EPriority.Info, 'GATEWAY_STATS', 'stats: ', stats);

  console.log('');
  console.log('📊 Gateway Pool Statistics');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total gateways:     ${stats['total_gateways']}`);
  console.log(`Used gateways:      ${stats['used_gateways']}`);
  console.log(`Ready gateways:     ${stats['ready_gateways']}`);
  console.log(`Unused (not ready): ${stats['unused_not_ready_gateways']}`);
  console.log('');

  // Also show detailed gateway list
  const gatewaysResult = await pg.query(
    `SELECT 
      g.gateway_id,
      g.container_name,
      g.http_port,
      g.vpn_port,
      g.ready,
      COUNT(og.organization_id) FILTER (WHERE og.ended_at IS NULL) as active_allocations
    FROM gateways g
    LEFT JOIN organizations_gateways og ON g.gateway_id = og.gateway_id
    GROUP BY g.gateway_id, g.container_name, g.http_port, g.vpn_port, g.ready
    ORDER BY g.container_name`,
    []
  );

  const gatewaySet = gatewaysResult.next();
  if (!gatewaySet) {
    console.log('No gateways found');
    return;
  }

  const gateways = gatewaySet.allRows();

  console.log('📋 Gateway Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const gateway of gateways) {
    const status = gateway['ready'] ? '✅ Ready' : '⏸️  Not Ready';
    const allocations = (gateway['active_allocations'] as number) || 0;
    const allocationText =
      allocations > 0
        ? ` (${allocations} allocation${allocations > 1 ? 's' : ''})`
        : '';

    console.log(`${gateway['container_name'] || 'N/A'}`);
    console.log(`  Status: ${status}${allocationText}`);
    console.log(`  HTTP: ${gateway['http_port']}, VPN: ${gateway['vpn_port']}`);
    console.log(`  ID: ${gateway['gateway_id']}`);
    console.log('');
  }
};

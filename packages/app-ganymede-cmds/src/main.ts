import { Command } from 'commander';
import { addGateway } from './addGateway';
import { gatewayStats } from './gatewayStats';

const program = new Command();

program
  .name('ganymede-cmds')
  .description('CLI for Ganymede commands')
  .version('1.0.0');

program
  .command('add-gateway')
  .description('Add a new gateway to the pool')
  .requiredOption('-gv, --gw-version <version>', 'Version of the gateway')
  .requiredOption('-c, --container-name <name>', 'Docker container name (e.g., gw-pool-dev-001-0)')
  .requiredOption('-hp, --http-port <port>', 'Gateway HTTP port (e.g., 7100)', parseInt)
  .requiredOption('-vp, --vpn-port <port>', 'Gateway VPN port (e.g., 49100)', parseInt)
  .action(async (options) => {
    await addGateway(
      options.gwVersion,
      options.containerName,
      options.httpPort,
      options.vpnPort
    );
    process.exit(0);
  });

program
  .command('gateway-stats')
  .description('Check the stats of gateways')
  .action(async () => {
    await gatewayStats();
    process.exit(0);
  });

program.parse(process.argv);

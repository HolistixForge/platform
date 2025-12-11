import { Command } from 'commander';
import { addGateway } from './addGateway';
import { gatewayStats } from './gatewayStats';
import {
  removeGateway,
  setGatewayReady,
  getGatewayIdByContainer,
  checkGatewayAllocations,
} from './removeGateway';

const program = new Command();

program
  .name('ganymede-cmds')
  .description('CLI for Ganymede commands')
  .version('1.0.0');

program
  .command('add-gateway')
  .description('Add a new gateway to the pool')
  .requiredOption('-gv, --gw-version <version>', 'Version of the gateway')
  .requiredOption(
    '-c, --container-name <name>',
    'Docker container name (e.g., gw-pool-dev-001-0)'
  )
  .requiredOption(
    '-hp, --http-port <port>',
    'Gateway HTTP port (e.g., 7100)',
    parseInt
  )
  .requiredOption(
    '-vp, --vpn-port <port>',
    'Gateway VPN port (e.g., 49100)',
    parseInt
  )
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
  .command('remove-gateway')
  .description('Remove a gateway from the database')
  .option('-g, --gateway-id <id>', 'Gateway ID (UUID)')
  .option(
    '-c, --container-name <name>',
    'Container name (alternative to gateway-id)'
  )
  .action(async (options) => {
    let gatewayId: string | null = null;

    if (options.gatewayId) {
      gatewayId = options.gatewayId;
    } else if (options.containerName) {
      gatewayId = await getGatewayIdByContainer(options.containerName);
      if (!gatewayId) {
        console.error(
          `❌ Gateway not found for container: ${options.containerName}`
        );
        process.exit(1);
      }
    } else {
      console.error('❌ Either --gateway-id or --container-name is required');
      process.exit(1);
    }

    await removeGateway(gatewayId as string);
    process.exit(0);
  });

program
  .command('set-gateway-ready')
  .description('Set gateway ready status')
  .requiredOption('-g, --gateway-id <id>', 'Gateway ID (UUID)')
  .requiredOption(
    '-r, --ready <true|false>',
    'Ready status',
    (value) => value === 'true'
  )
  .action(async (options) => {
    await setGatewayReady(options.gatewayId, options.ready);
    process.exit(0);
  });

program
  .command('check-gateway-allocations')
  .description('Check if gateway has active allocations')
  .option('-g, --gateway-id <id>', 'Gateway ID (UUID)')
  .option(
    '-c, --container-name <name>',
    'Container name (alternative to gateway-id)'
  )
  .action(async (options) => {
    let gatewayId: string | null = null;

    if (options.gatewayId) {
      gatewayId = options.gatewayId;
    } else if (options.containerName) {
      gatewayId = await getGatewayIdByContainer(options.containerName);
      if (!gatewayId) {
        console.error(
          `❌ Gateway not found for container: ${options.containerName}`
        );
        process.exit(1);
      }
    } else {
      console.error('❌ Either --gateway-id or --container-name is required');
      process.exit(1);
    }

    const allocations = await checkGatewayAllocations(gatewayId as string);
    console.log(`Active allocations: ${allocations.count}`);
    if (allocations.count > 0) {
      console.log(
        'Organizations:',
        JSON.stringify(allocations.organizations, null, 2)
      );
    }
    process.exit(allocations.count > 0 ? 1 : 0);
  });

program
  .command('gateway-stats')
  .description('Check the stats of gateways')
  .action(async () => {
    await gatewayStats();
    process.exit(0);
  });

program.parse(process.argv);

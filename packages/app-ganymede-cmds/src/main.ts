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
  .description('Add a new gateway')
  .requiredOption('-h, --fqdn <hostname>', 'Fully Qualified Domain Name of the gateway')
  .requiredOption('-gv, --gw-version <version>', 'Version of the gateway')
  .action(async (options) => {
    await addGateway(options.fqdn, options.gwVersion);
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

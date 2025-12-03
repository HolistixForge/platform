import { EPriority, log } from '@holistix/log';
import { sleep } from '@holistix/shared-types';
import { CONFIG } from '../config';

/**
 * Signal Gateway is Ready
 *
 * Called after gateway has started and is ready to accept connections.
 * Marks the gateway as available for allocation.
 */
export async function signalGatewayReady(gateway_id: string): Promise<void> {
  const ganymedeFqdn = CONFIG.GANYMEDE_FQDN;

  if (!ganymedeFqdn) {
    log(
      EPriority.Warning,
      'GATEWAY_READY',
      'GANYMEDE_FQDN not configured - skipping ready signal'
    );
    return;
  }

  log(EPriority.Info, 'GATEWAY_READY', 'Signaling ready status to Ganymede...');

  while (true) {
    try {
      const response = await fetch(`https://${ganymedeFqdn}/gateway/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CONFIG.GATEWAY_TOKEN}`,
        },
        body: JSON.stringify({ gateway_id }),
      });

      if (!response.ok) {
        log(
          EPriority.Warning,
          'GATEWAY_READY',
          `Failed to signal ready: ${response.status}. Retrying in 5s...`
        );
        await sleep(5);
        continue;
      }

      log(
        EPriority.Info,
        'GATEWAY_READY',
        'Successfully signaled ready to Ganymede'
      );
      break;
    } catch (error: any) {
      log(
        EPriority.Warning,
        'GATEWAY_READY',
        `Failed to signal ready: ${error.message}. Retrying in 5s...`
      );
      await sleep(5);
    }
  }
}

import { EPriority, log } from '@holistix-forge/log';
import { sleep } from '@holistix-forge/simple-types';
import { CONFIG } from '../config';
import { createGanymedeClient } from '../lib/ganymede-client';

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

  // Use centralized Ganymede client (handles URL construction and container networking)
  // /gateway/ready requires GATEWAY_TOKEN (gateway-level token), not organization token
  const ganymedeClient = createGanymedeClient(undefined, CONFIG.GATEWAY_TOKEN);

  log(
    EPriority.Info,
    'GATEWAY_READY',
    `Signaling ready status to Ganymede at ${ganymedeClient.getBaseUrl()}...`
  );

  const maxRetries = 12; // 12 retries × 5s = 1 minute total
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await ganymedeClient.request({
        method: 'POST',
        url: '/gateway/ready',
        headers: {
          'Content-Type': 'application/json',
        },
        jsonBody: { gateway_id },
      });

      log(
        EPriority.Info,
        'GATEWAY_READY',
        'Successfully signaled ready to Ganymede'
      );
      return;
    } catch (error) {
      attempt++;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (attempt < maxRetries) {
        log(
          EPriority.Warning,
          'GATEWAY_READY',
          `Failed to signal ready (attempt ${attempt}/${maxRetries}): ${errorMessage}. Retrying in 5s...`
        );
        await sleep(5);
      } else {
        log(
          EPriority.Error,
          'GATEWAY_READY',
          `Failed to signal ready after ${maxRetries} attempts: ${errorMessage}. Giving up.`
        );
        throw new Error(
          `Failed to signal gateway ready after ${maxRetries} attempts`
        );
      }
    }
  }
}

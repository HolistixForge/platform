import { EPriority, log } from '@holistix-forge/log';
import { TOrganizationConfig } from '../types/organization-config';
import { createGanymedeClient } from '../lib/ganymede-client';

export async function fetchConfigFromGanymede(): Promise<TOrganizationConfig | null> {
  const gatewayToken = process.env.GATEWAY_TOKEN;

  if (!gatewayToken) {
    log(
      EPriority.Warning,
      'FETCH_CONFIG',
      'No GATEWAY_TOKEN - cannot fetch config'
    );
    return null;
  }

  try {
    log(EPriority.Info, 'FETCH_CONFIG', 'Fetching config from Ganymede...');

    // Use GanymedeClient for proper routing through Nginx
    const ganymedeClient = createGanymedeClient(gatewayToken);

    const response = await ganymedeClient.request({
      url: '/gateway/config',
      method: 'POST',
      jsonBody: {},
    });

    if (!response) {
      log(
        EPriority.Info,
        'FETCH_CONFIG',
        `No active allocation (gateway idle) - gateway_id: ${process.env.GATEWAY_ID}`
      );
      return null;
    }

    const config = response as TOrganizationConfig;
    log(
      EPriority.Info,
      'FETCH_CONFIG',
      `✅ Config fetched for org ${config.organization_name}`
    );

    return config;
  } catch (error: any) {
    // 404 means no allocation (gateway idle)
    if (error.status === 404) {
      log(
        EPriority.Info,
        'FETCH_CONFIG',
        `No active allocation (gateway idle) - gateway_id: ${process.env.GATEWAY_ID}`
      );
      return null;
    }

    log(
      EPriority.Error,
      'FETCH_CONFIG',
      `Failed to fetch config: ${error.message}`
    );
    return null;
  }
}

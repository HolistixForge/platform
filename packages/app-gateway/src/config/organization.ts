import * as fs from 'fs';
import { log } from '@monorepo/log';
import { TOrganizationConfig } from '../types/organization-config';

/**
 * Load organization configuration from environment or file
 *
 * For now, this is a placeholder. In production, this would:
 * - Fetch config from Ganymede API on gateway start
 * - Or read from a config file mounted by Docker/K8s
 */
export function loadOrganizationConfig(): TOrganizationConfig | null {
  // Option 1: From environment variable (JSON string)
  if (process.env.ORGANIZATION_CONFIG) {
    try {
      const config = JSON.parse(process.env.ORGANIZATION_CONFIG);
      log(
        6,
        'CONFIG',
        `Loaded organization config from ORGANIZATION_CONFIG env var`
      );
      return config;
    } catch (e: any) {
      log(3, 'CONFIG', `Failed to parse ORGANIZATION_CONFIG: ${e.message}`);
    }
  }

  // Option 2: From file (mounted by Docker/K8s)
  const configPath =
    process.env.ORGANIZATION_CONFIG_FILE || '/config/organization.json';
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      log(6, 'CONFIG', `Loaded organization config from ${configPath}`);
      return config;
    } catch (e: any) {
      log(
        3,
        'CONFIG',
        `Failed to load config from ${configPath}: ${e.message}`
      );
    }
  }

  // Option 3: Create mock config for development
  if (process.env.NODE_ENV === 'development') {
    log(
      5,
      'CONFIG',
      'No organization config found - using mock config for development'
    );
    return {
      organization_id: 'org_dev_123',
      organization_name: 'Development Organization',
      gateway_id: 'gateway_dev_456',
      gateway_token: process.env.GATEWAY_TOKEN || 'dev-token',
      ganymede_fqdn: process.env.GANYMEDE_FQDN || 'localhost:3000',
      members: [],
      projects: [],
    };
  }

  log(3, 'CONFIG', 'No organization config found and not in development mode');
  return null;
}

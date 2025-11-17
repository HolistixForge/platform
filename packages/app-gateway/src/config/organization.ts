import * as fs from 'fs';
import { log } from '@monorepo/log';
import { TOrganizationConfig } from '../types/organization-config';

/**
 * Load organization configuration from file if it exists
 * (hot gateway app restart)
 */
export function loadOrganizationConfig(): TOrganizationConfig | null {
  const configPath = '/config/organization.json';
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

  log(3, 'CONFIG', 'No organization config found');
  return null;
}

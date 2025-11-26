import * as fs from 'fs';
import { EPriority, log } from '@monorepo/log';
import { TJson } from '@monorepo/simple-types';
import { TOrganizationConfig } from '../types/organization-config';

const VPN_CONFIG_FILE = '/tmp/vpn-config.json';

const ORGANIZATION_CONFIG_FILE = '/config/organization.json';

const writeJsonFile = (filename: string, object: TJson) => {
  fs.writeFileSync(filename, JSON.stringify(object, null, 2), 'utf-8');
};

const readJsonFileOrNull = (filename: string) => {
  try {
    const fileData = fs.readFileSync(filename, 'utf-8');
    const jsonObj = JSON.parse(fileData as string);
    log(EPriority.Debug, 'CONFIG', `loaded config ${filename}`);
    return jsonObj;
  } catch (error) {
    log(EPriority.Debug, 'CONFIG', `No config file ${filename}`);
    return null;
  }
};

/**
 * Load organization configuration from file if it exists
 * (hot gateway app restart)
 */
export function loadOrganizationConfig(): TOrganizationConfig | null {
  const configPath = ORGANIZATION_CONFIG_FILE;
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      log(
        EPriority.Info,
        'CONFIG',
        `Loaded organization config from ${configPath}`
      );
      return config;
    } catch (e: any) {
      log(
        EPriority.Error,
        'CONFIG',
        `Failed to load config from ${configPath}: ${e.message}`
      );
    }
  }

  log(EPriority.Error, 'CONFIG', 'No organization config found');
  return null;
}

/**
 * Save organization configuration to file
 * (for hot gateway app restart)
 */
export function setOrganizationConfig(config: TOrganizationConfig): void {
  const configPath = ORGANIZATION_CONFIG_FILE;
  writeJsonFile(configPath, config as unknown as TJson);
  log(EPriority.Info, 'CONFIG', `Saved organization config to ${configPath}`);
}

/**
 * VPN Configuration
 * Shared across all projects in an organization
 */
export type TVPNConfig = {
  status: 'ok' | 'error';
  pid: number;
  temp_dir: string;
  port: number;
  hostname: string;
  certificates: {
    'clients.crt': string;
    'clients.key': string;
    'ca.crt': string;
    'ta.key': string;
  };
};

export const VPN: TVPNConfig | null = readJsonFileOrNull(VPN_CONFIG_FILE);

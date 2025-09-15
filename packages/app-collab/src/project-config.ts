// import { development } from '@monorepo/backend-engine';
import { log } from '@monorepo/log';
import { TJson } from '@monorepo/simple-types';
import { TProjectConfig } from '@monorepo/gateway';
import * as fs from 'fs';

//

const DEV_PROJECT_CONFIG_FILE = '/tmp/project-config.json';

const VPN_CONFIG_FILE = '/tmp/vpn-config.json';

const writeJsonFile = (filename: string, object: TJson) => {
  fs.writeFileSync(filename, JSON.stringify(object, null, 2), 'utf-8');
};

const readJsonFileOrNull = (filename: string) => {
  try {
    const fileData = fs.readFileSync(filename, 'utf-8');
    const jsonObj = JSON.parse(fileData as string);
    log(7, 'CONFIG', `loaded config ${filename}`);
    return jsonObj;
  } catch (error) {
    log(7, 'CONFIG', `No config file ${filename}`);
    return null;
  }
};

//

export let PROJECT: TProjectConfig | null = readJsonFileOrNull(
  DEV_PROJECT_CONFIG_FILE
);

export const setProjectConfig = (project: TProjectConfig) => {
  PROJECT = project;
  writeJsonFile(DEV_PROJECT_CONFIG_FILE, project);
};

//

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

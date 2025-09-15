import * as fs from 'fs';
import * as path from 'path';
import * as Y from 'yjs';
import { spawnSync } from 'child_process';

import { RunException } from '@monorepo/backend-engine';
import { TJson } from '@monorepo/simple-types';
import { log } from '@monorepo/log';
import type { ModuleBackend } from '@monorepo/module';
import { TMyfetchRequest } from '@monorepo/simple-types';
import { myfetch } from '@monorepo/backend-engine';
import { ForwardException } from '@monorepo/backend-engine';
import {
  getAllSharedDataAsJSON,
  setAllSharedDataFromJSON,
} from '@monorepo/collab-engine';

//

export type TGatewayExtraContext = {
  gateway: {
    toGanymede: <T>(r: TMyfetchRequest) => Promise<T>;
    loadDoc: () => boolean;
    updateReverseProxy: (
      services: { location: string; ip: string; port: number }[]
    ) => Promise<void>;
    gatewayStopNotify: () => Promise<void>;
    gatewayFQDN: string;
  };
};

//

export type TProjectConfig = {
  GANYMEDE_API_TOKEN: string;
  PROJECT_ID: string;
};

export type TGatewayInitExtraContext = {
  project: TProjectConfig;
  config: {
    GANYMEDE_FQDN: string;
    GATEWAY_TOKEN: string;
    GATEWAY_FQDN: string;
    SCRIPTS_DIR: string;
  };
  ydoc: Y.Doc;
};

//

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'gateway',
    loadExtraContext: ({ extraContext }): TGatewayExtraContext => {
      const gateway_init = (extraContext as any)
        .gateway_init as TGatewayInitExtraContext;
      //
      // save doc :
      //  - every 2 minutes
      //  - on SIGUSR1
      //  - on exit
      //
      setInterval(() => {
        saveDoc();
      }, 120 * 1000);

      // Send signal with: kill -USR1 <pid>
      process.on('SIGUSR1', () => {
        log(6, 'SIGNAL', 'Received SIGUSR1, saving doc state');
        saveDoc();
      });

      const STORAGE_PATH = './data';

      const getProjectStoragePath = () => {
        // Take first part of UUID (before first dash) as folder name
        const folderName = gateway_init.project.PROJECT_ID.split('-')[0];
        return path.join(STORAGE_PATH, folderName);
      };

      //

      const ensureStorageDirectory = () => {
        const storagePath = getProjectStoragePath();
        if (!storagePath) return false;

        try {
          if (!fs.existsSync(STORAGE_PATH)) {
            fs.mkdirSync(STORAGE_PATH);
          }
          if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath);
          }
          return true;
        } catch (err) {
          console.error('Failed to create storage directory:', err);
          return false;
        }
      };

      //

      const getLatestSavedFile = () => {
        const storagePath = getProjectStoragePath();
        if (!storagePath) return null;

        try {
          const files = fs
            .readdirSync(storagePath)
            .filter((file) => file.endsWith('.json'))
            .map((file) => ({
              name: file,
              path: path.join(storagePath, file),
              timestamp: parseInt(file.replace('.json', '')),
            }))
            .sort((a, b) => b.timestamp - a.timestamp);

          return files.length > 0 ? files[0].path : null;
        } catch (err) {
          console.error('Failed to list saved files:', err);
          return null;
        }
      };

      //

      const loadDoc = () => {
        let success = false;
        try {
          const latestFile = getLatestSavedFile();
          if (!latestFile) {
            console.log('No saved data found');
            return false;
          }

          const savedData = fs.readFileSync(latestFile, 'utf-8');
          const jsonData = JSON.parse(savedData);
          setAllSharedDataFromJSON(gateway_init.ydoc, jsonData);
          console.log(`Loaded data from ${latestFile}`);
          success = true;
        } catch (err) {
          console.error('Failed to load saved shared data:', err);
        }
        return success;
      };

      //

      const saveDoc = () => {
        try {
          if (!ensureStorageDirectory()) {
            console.error('Failed to ensure storage directory exists');
            return;
          }

          const storagePath = getProjectStoragePath();
          if (!storagePath) {
            console.error('No project ID available for saving');
            return;
          }

          const timestamp = Date.now();
          const filename = path.join(storagePath, `${timestamp}.json`);
          const savedFile = JSON.stringify(
            getAllSharedDataAsJSON(gateway_init.ydoc)
          );
          fs.writeFileSync(filename, savedFile);
          console.log(`Saved project data to ${filename}`);
        } catch (err) {
          console.error('Failed to save project data:', err);
        }
      };

      //

      const ganymede_api = `https://${gateway_init.config.GANYMEDE_FQDN}`;

      const toGanymede = async <T>(request: TMyfetchRequest): Promise<T> => {
        if (!request.headers?.authorization)
          request.headers = {
            ...request.headers,
            authorization: gateway_init.project.GANYMEDE_API_TOKEN,
          };
        request.url = `${ganymede_api}${request.url}`;
        request.pathParameters = {
          ...request.pathParameters,
          project_id: gateway_init.project.PROJECT_ID,
        };
        const response = await myfetch(request);
        log(6, 'GATEWAY', `${request.url} response: ${response.statusCode}`);
        if (response.statusCode !== 200)
          throw new ForwardException(request, response);

        return response.json as T;
      };

      type EScripts = 'update-nginx-locations' | 'reset-gateway';

      //

      const runScript = (name: EScripts, inputString?: string) => {
        const DIR = gateway_init.config.SCRIPTS_DIR;
        const cmd = `${DIR}/main.sh`;
        const args = ['-r', `bin/${name}.sh`];

        const fcmd = `${cmd} ${args.join(' ')}`;

        let output;

        try {
          const result = spawnSync(
            cmd,
            args,
            inputString ? { input: inputString } : undefined
          );
          if (result.error) {
            throw new RunException(
              `Error executing [${fcmd}]: ${result.error.message}`
            );
          }
          output = result.stdout.toString();
        } catch (err: any) {
          throw new RunException(`Error executing [${fcmd}]: ${err.message}`);
        }
        let json;
        try {
          json = JSON.parse(output);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
          throw new RunException(
            `Error executing [${fcmd}]: not a JSON output [[[${output}]]]`
          );
        }
        if (json.status === 'error') {
          throw new RunException(
            `Error executing script [${name}]: ${json.error}`
          );
        } else if (json.status === 'ok') return json as TJson;
        else
          throw new RunException(
            `Error executing [${fcmd}]: invalid output status format [${json.status}]`
          );
      };

      //
      //

      return {
        gateway: {
          toGanymede,
          loadDoc,
          //
          updateReverseProxy: async (
            services: { location: string; ip: string; port: number }[]
          ) => {
            const config = services
              .map((s) => `${s.location} ${s.ip} ${s.port}\n`)
              .join('');
            runScript('update-nginx-locations', config);
          },
          //
          gatewayStopNotify: async () => {
            log(6, 'GATEWAY', 'gatewayStopNotify');

            await toGanymede({
              url: '/gateway-stop',
              method: 'POST',
              headers: { authorization: gateway_init.config.GATEWAY_TOKEN },
            });
            saveDoc();
            runScript('reset-gateway');
          },
          //
          gatewayFQDN: gateway_init.config.GATEWAY_FQDN,
        },
      };
    },
  },
};

/*

*/

//

// import { EventSourcePolyfill } from 'event-source-polyfill';

/*
export type TGanymedeEventSourceCallback = (
  event: MessageEvent,
  resolve: (v: any) => void,
  reject: (reason?: any) => void,
  es: EventSourcePolyfill
) => void;

//

export const toGanymedeEventSource = async (
  request: TMyfetchRequest,
  onMessage: TGanymedeEventSourceCallback
): Promise<void> => {
  if (!request.url.startsWith('/')) request.url = `/${request.url}`;
  request.url = `${ganymede_api}${request.url}`;
  request.pathParameters = {
    ...request.pathParameters,
    project_id: PROJECT!.PROJECT_ID,
  };
  const fu = fullUri(request);

  await new Promise((resolve, reject) => {
    const es = new EventSourcePolyfill(fu, {
      headers: request.headers,
    });
    es.onmessage = (event: any) => onMessage(event, resolve, reject, es);
  });
};
*/

import { graftYjsWebsocket } from './websocket';
import * as http from 'http';
import * as https from 'https';

import { myfetch, TStart } from '@monorepo/backend-engine';
import { BackendEventProcessor } from '@monorepo/collab-engine';
import { TJupyterExtraArgs } from '@monorepo/jupyter';
import { log } from '@monorepo/log';
import { makeUuid, sleep } from '@monorepo/simple-types';
import { TProjectConfig } from '@monorepo/gateway';

import { initProjectCollaboration } from './build-collab';
import { startEventsReducerServer } from './reducer-server';
import { PROJECT, VPN, setProjectConfig } from './project-config';
import { CONFIG } from './config';

//

let bep: BackendEventProcessor<any, TJupyterExtraArgs>;
let servers: (http.Server | https.Server)[];

//

export let ROOM_ID = '';

export const startProjectCollab = async (project: TProjectConfig) => {
  setProjectConfig(project);
  ROOM_ID = makeUuid();
  await initProjectCollaboration(bep);
  graftYjsWebsocket(servers, ROOM_ID);
};

//

(async function main() {
  bep = new BackendEventProcessor<any, TJupyterExtraArgs>();

  const bindings: TStart[] = JSON.parse(CONFIG.SERVER_BIND);

  servers = await startEventsReducerServer(bep, bindings);

  if (!VPN) throw new Error('VPN config read failed');

  // restart project when recompilation restart app
  if (PROJECT) startProjectCollab(PROJECT);
  else {
    // call "set gw ready" ganymede API endpoint
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await myfetch({
          url: `https://${CONFIG.GANYMEDE_FQDN}/gateway-ready`,
          method: 'POST',
          headers: { authorization: CONFIG.GATEWAY_TOKEN },
        });
      } catch (e: any) {
        log(6, 'GATEWAY', `can't set ready flag on Ganymede [${e.message}]`);
        await sleep(5);
      }
    }
  }
})();

//

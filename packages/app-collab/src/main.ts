import { graftYjsWebsocket } from './websocket';
import * as http from 'http';
import * as https from 'https';
import {
  TAllEvents,
  initProjectCollaboration,
  toGanymede,
} from './build-collab';
import { startEventsReducerServer } from './reducer-server';
import { TStart, development } from '@monorepo/backend-engine';
import { Dispatcher } from '@monorepo/collab-engine';
import { TJupyterExtraArgs } from '@monorepo/jupyter';
import {
  PROJECT,
  TProjectConfig,
  VPN,
  setProjectConfig,
} from './project-config';
import { log } from '@monorepo/log';
import { sleep } from '@monorepo/simple-types';
import { CONFIG } from './config';

//

let dispatcher: Dispatcher<TAllEvents, TJupyterExtraArgs>;
let servers: (http.Server | https.Server)[];

///

export const startProjectCollab = async (project: TProjectConfig) => {
  setProjectConfig(project);
  await initProjectCollaboration(dispatcher);
  graftYjsWebsocket(servers, PROJECT!.YJS_DOC_ID);
};

//

(async function main() {
  dispatcher = new Dispatcher<TAllEvents, TJupyterExtraArgs>();

  const bindings: TStart[] = JSON.parse(CONFIG.SERVER_BIND);

  servers = await startEventsReducerServer(dispatcher, bindings);

  if (!VPN) throw new Error('VPN config read failed');

  // restart when development recompilation restart app
  if (development(() => true) && PROJECT) startProjectCollab(PROJECT);
  else {
    // call "set gw ready" ganymede API endpoint
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await toGanymede({
          url: '/gateway-ready',
          method: 'POST',
          headers: { authorization: CONFIG.GATEWAY_TOKEN },
        });
        break;
      } catch (e) {
        log(6, 'GATEWAY', "can't set ready flag on Ganymede");
        await sleep(5);
      }
    }
  }
})();

//

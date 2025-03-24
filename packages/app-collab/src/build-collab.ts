import * as fs from 'fs';
import * as Y from 'yjs';
const u = require('y-websocket/bin/utils');
// import { EventSourcePolyfill } from 'event-source-polyfill';

import {
  Dispatcher,
  SharedTypes,
  TCollabNativeEvent,
  TCollaborativeChunk,
  TValidSharedData,
  YjsSharedTypes,
  compileChunks,
} from '@monorepo/collab-engine';
import {
  Core_loadData,
  TCoreSharedData,
  CoreReducer,
  MetaReducer,
  TCoreEvent,
} from '@monorepo/core';
import {
  TabPayload,
  TTabEvents,
  Tabs_loadData,
  TTabsSharedData,
  TabsReducer,
} from '@monorepo/tabs';
import {
  Space_loadData,
  TSpaceSharedData,
  SpaceReducer,
  TSpaceEvent,
} from '@monorepo/space';
import {
  TChatEvent,
  Chat_loadData,
  TChatSharedData,
  ChatReducer,
} from '@monorepo/chats';
import {
  TServerEvents,
  Servers_loadData,
  TServersSharedData,
  ServersReducer,
} from '@monorepo/servers';
import {
  TDemiurgeNotebookEvent,
  TJupyterSharedData,
  Jupyter_loadData,
  JupyterReducer,
} from '@monorepo/jupyter';
import { SocialsReducer } from '@monorepo/socials';
import {
  TNotionEvent,
  TNotionSharedData,
  Notion_loadData,
  NotionReducer,
} from '@monorepo/notion';

import { log } from '@monorepo/log';
import { loadCollaborationData } from './load-collab';
import { TJsonObject, TMyfetchRequest } from '@monorepo/simple-types';
import { ForwardException, myfetch } from '@monorepo/backend-engine';

import { CONFIG } from './config';
import { PROJECT } from './project-config';
import { runScript } from './run-script';
import { ROOM_ID } from './main';

//
//
//

const STORAGE_PATH = './data';

let ydoc: Y.Doc;

const filePath = (suffix: string) => {
  return `${STORAGE_PATH}/${PROJECT?.PROJECT_ID}-${suffix}.json`;
};

const loadDoc = () => {
  log(6, 'YJS', `Creating Yjs doc: [${ROOM_ID}]`);
  ydoc = u.getYDoc(ROOM_ID);

  try {
    const data = fs.readFileSync(filePath('yjs-db'), 'utf-8');
    Y.applyUpdate(ydoc, Buffer.from(JSON.parse(data)));
    return true;
  } catch (err) {
    console.error('failed to load project data', err);
    return false;
  }
};

const saveDoc = (saved: TJsonObject) => {
  try {
    const savedFile = JSON.stringify(saved);
    fs.writeFileSync(filePath('saved'), savedFile);

    const db = JSON.stringify([...Y.encodeStateAsUpdate(ydoc)]);
    fs.writeFileSync(filePath('yjs-db'), db);
  } catch (err) {
    console.error('failed to save project data', err);
  }
};

//
// save doc :
//  - every 2 minutes
//  - on SIGUSR1
//  - on exit
//

setInterval(() => {
  if (PROJECT?.PROJECT_ID) saveDoc({});
}, 120 * 1000);

// Send signal with: kill -USR1 <pid>
process.on('SIGUSR1', () => {
  log(6, 'SIGNAL', 'Received SIGUSR1, saving doc state');
  const saved: TJsonObject = {};
  // TODO: get reducers to save state
  saveDoc(saved);
});

//

const gatewayStopNotify = async (saved: TJsonObject) => {
  await toGanymede({
    url: '/gateway-stop',
    method: 'POST',
    headers: { authorization: CONFIG.GATEWAY_TOKEN },
  });
  saveDoc(saved);
  runScript('reset-gateway');
};

//

const updateReverseProxy = async (
  services: { location: string; ip: string; port: number }[]
) => {
  const config = services
    .map((s) => `${s.location} ${s.ip} ${s.port}\n`)
    .join('');
  runScript('update-nginx-locations', config);
};

//
//
//

const chunks: TCollaborativeChunk[] = [
  {
    sharedData: (st: SharedTypes) => Core_loadData(st),
    reducers: (sd: TValidSharedData) => [
      new CoreReducer(),
      new MetaReducer(gatewayStopNotify),
    ],
  },
  {
    sharedData: (st: SharedTypes) => Space_loadData(st),
    reducers: (sd: TValidSharedData) => [new SpaceReducer()],
  },
  {
    sharedData: (st: SharedTypes) => Chat_loadData(st),
    reducers: (sd: TValidSharedData) => [new ChatReducer()],
  },
  {
    sharedData: (st: SharedTypes) => Servers_loadData(st),
    reducers: (sd: TValidSharedData) => [
      new ServersReducer(updateReverseProxy),
    ],
    extraContext: (sd: TValidSharedData) => ({
      toGanymede: toGanymede,
      gatewayFQDN: CONFIG.GATEWAY_FQDN,
    }),
  },
  {
    sharedData: (st: SharedTypes) => Tabs_loadData(st),
    reducers: (sd: TValidSharedData) => [new TabsReducer()],
  },
  {
    sharedData: (st: SharedTypes) => Jupyter_loadData(st),
    reducers: (sd: TValidSharedData) => [
      new JupyterReducer(sd as TServersSharedData & TJupyterSharedData),
    ],
  },
  {
    sharedData: (st: SharedTypes) => Notion_loadData(st),
    reducers: (sd: TValidSharedData) => [new NotionReducer()],
    extraContext: (sd: TValidSharedData) => ({
      notionApiKey: CONFIG.NOTION_API_KEY,
    }),
  },
  {
    reducers: (sd: TValidSharedData) => [new SocialsReducer()],
  },
];

//
//
//

export type TSd = TCoreSharedData &
  TServersSharedData &
  TSpaceSharedData &
  TChatSharedData &
  TTabsSharedData &
  TJupyterSharedData &
  TNotionSharedData;

export type TAllEvents =
  | TCoreEvent
  | TDemiurgeNotebookEvent
  | TSpaceEvent
  | TServerEvents
  | TChatEvent
  | TTabEvents<TabPayload>
  | TNotionEvent
  | TCollabNativeEvent;

//
//

export async function initProjectCollaboration(
  dispatcher: Dispatcher<TAllEvents, {}>
) {
  const loadedFromFile = loadDoc();

  const yst = new YjsSharedTypes(ydoc);

  const extraContext = {};
  const loadChunks = compileChunks(chunks, dispatcher, extraContext);

  const sd = loadChunks(yst) as TSd;

  dispatcher.bindData(yst, sd, extraContext);

  (ydoc as any).awareness.on('change', ({ removed }: { removed: number[] }) => {
    // console.log('AWARENESS CHANGES:', { added, updated, removed });
    removed.forEach((userId) => {
      dispatcher.dispatch({
        type: 'user-leave',
        userId: userId,
        awarenessState: (ydoc as any).awareness.getStates().get(userId),
      });
    });
  });

  // load
  if (!loadedFromFile) await loadCollaborationData(sd, dispatcher);

  const interval = 5000;
  setInterval(() => {
    try {
      dispatcher.dispatch({ type: 'periodic', interval, date: new Date() });
    } catch (err) {
      console.log(err);
    }
  }, interval);

  return { dispatcher };
}

/*
 *
 * a function to call ganymede API endpoint
 *
 */

// or simply: http://ganymede
const ganymede_api = `https://${CONFIG.GANYMEDE_FQDN}`;

/**
 * call Ganymede API endpoint from collab
 * @returns
 */

export const toGanymede = async <T>(request: TMyfetchRequest): Promise<T> => {
  request.url = `${ganymede_api}${request.url}`;
  request.pathParameters = {
    ...request.pathParameters,
    project_id: PROJECT?.PROJECT_ID || 'none',
  };
  const response = await myfetch(request);
  log(6, 'GATEWAY', `${request.url} response: ${response.statusCode}`);
  if (response.statusCode !== 200)
    throw new ForwardException(request, response);

  return response.json as T;
};

//

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

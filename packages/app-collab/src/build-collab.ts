import { Doc } from 'yjs';
const u = require('y-websocket/bin/utils');
import { WebsocketProvider } from 'y-websocket';
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
import { TMyfetchRequest } from '@monorepo/simple-types';
import { ForwardException, myfetch } from '@monorepo/backend-engine';

import { CONFIG } from './config';

import { PROJECT } from './project-config';
import { runScript } from './run-script';

//
//
//

const gatewayStopNotify = async () => {
  toGanymede({
    url: '/gateway-stop',
    method: 'POST',
    headers: { authorization: CONFIG.GATEWAY_TOKEN },
  });
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

type WSSharedDoc = Doc & {
  awareness: WebsocketProvider['awareness'];
};

//
//

export async function initProjectCollaboration(
  dispatcher: Dispatcher<TAllEvents, {}>
) {
  const docId = PROJECT!.YJS_DOC_ID;
  log(6, 'YJS', `Creating Yjs doc: [${docId}]`);
  const ydoc: WSSharedDoc = u.getYDoc(docId);

  const yst = new YjsSharedTypes(ydoc);

  const extraContext = {};
  const loadChunks = compileChunks(chunks, dispatcher, extraContext);

  const sd = loadChunks(yst) as TSd;

  dispatcher.bindData(yst, sd, extraContext);

  ydoc.awareness.on('change', ({ removed }: { removed: number[] }) => {
    // console.log('AWARENESS CHANGES:', { added, updated, removed });
    removed.forEach((userId) => {
      dispatcher.dispatch({
        type: 'user-leave',
        userId: userId,
        awarenessState: ydoc.awareness.getStates().get(userId),
      });
    });
  });

  // load
  await loadCollaborationData(sd, dispatcher);

  const interval = 15000;
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

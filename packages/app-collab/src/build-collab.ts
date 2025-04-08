import * as fs from 'fs';
import * as path from 'path';
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
  YjsSharedEditor,
  EDITORS_YTEXT_YMAP_KEY,
  getAllSharedDataAsJSON,
  setAllSharedDataFromJSON,
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
import { TMyfetchRequest } from '@monorepo/simple-types';
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

const getProjectStoragePath = () => {
  if (!PROJECT?.PROJECT_ID) return null;
  // Take first part of UUID (before first dash) as folder name
  const folderName = PROJECT.PROJECT_ID.split('-')[0];
  return path.join(STORAGE_PATH, folderName);
};

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
    setAllSharedDataFromJSON(ydoc, jsonData);
    console.log(`Loaded data from ${latestFile}`);
    success = true;
  } catch (err) {
    console.error('Failed to load saved shared data:', err);
  }
  return success;
};

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
    const savedFile = JSON.stringify(getAllSharedDataAsJSON(ydoc));
    fs.writeFileSync(filename, savedFile);
    console.log(`Saved project data to ${filename}`);
  } catch (err) {
    console.error('Failed to save project data:', err);
  }
};

//
// save doc :
//  - every 2 minutes
//  - on SIGUSR1
//  - on exit
//

setInterval(() => {
  if (PROJECT?.PROJECT_ID) saveDoc();
}, 120 * 1000);

// Send signal with: kill -USR1 <pid>
process.on('SIGUSR1', () => {
  log(6, 'SIGNAL', 'Received SIGUSR1, saving doc state');
  saveDoc();
});

//

const gatewayStopNotify = async () => {
  await toGanymede({
    url: '/gateway-stop',
    method: 'POST',
    headers: { authorization: CONFIG.GATEWAY_TOKEN },
  });
  saveDoc();
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
  // create Y document
  ydoc = u.getYDoc(ROOM_ID);

  const yst = new YjsSharedTypes(ydoc);
  const yse = new YjsSharedEditor(ydoc.getMap(EDITORS_YTEXT_YMAP_KEY));

  const extraContext = {};
  const loadChunks = compileChunks(chunks, dispatcher, extraContext);
  const sd = loadChunks(yst) as TSd;

  // load data from saved file
  const loaded = loadDoc();
  const isNew = !loaded;

  // attach data to dispatcher
  dispatcher.bindData(yst, yse, sd, extraContext);

  // let every reducers update data from up to date data (API calls ...)
  await dispatcher.dispatch({ type: 'core:load' });

  //
  // new project initialization
  //

  const DEFAULT_VIEW_1 = 'view-1';

  if (isNew) {
    console.log('new project initialization');
    await dispatcher.dispatch({
      type: 'space:new-view',
      viewId: DEFAULT_VIEW_1,
    });
    await dispatcher.dispatch({
      type: 'tabs:add-tab',
      path: [],
      title: 'node-editor-1',
      payload: { type: 'node-editor', viewId: DEFAULT_VIEW_1 },
    });
    await dispatcher.dispatch({
      type: 'tabs:add-tab',
      path: [],
      title: 'resources grid',
      payload: { type: 'resources-grid' },
    });
  }

  //
  //
  //

  //

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
 * call Ganymede API endpoint from collab, use passed token or project token or default gateway token
 * @returns
 */

export const toGanymede = async <T>(request: TMyfetchRequest): Promise<T> => {
  if (!request.headers?.authorization)
    request.headers = {
      ...request.headers,
      authorization: PROJECT?.GANYMEDE_API_TOKEN || CONFIG.GATEWAY_TOKEN,
    };
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

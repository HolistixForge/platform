import * as fs from 'fs';
import * as path from 'path';
import * as Y from 'yjs';
const u = require('y-websocket/bin/utils');
// import { EventSourcePolyfill } from 'event-source-polyfill';

import {
  BackendEventProcessor,
  TCollabNativeEvent,
  TCollaborativeChunk,
  YjsSharedTypes,
  compileChunks,
  YjsSharedEditor,
  EDITORS_YTEXT_YMAP_KEY,
  getAllSharedDataAsJSON,
  setAllSharedDataFromJSON,
} from '@monorepo/collab-engine';
import { TCoreSharedData, TCoreEvent } from '@monorepo/core';
import { TabPayload, TTabEvents, TTabsSharedData } from '@monorepo/tabs';
import { TSpaceSharedData, TSpaceEvent } from '@monorepo/space';
import { TChatEvent, TChatSharedData } from '@monorepo/chats';
import { TServerEvents, TServersSharedData } from '@monorepo/servers';
import { TJupyterEvent, TJupyterSharedData } from '@monorepo/jupyter';

import { TNotionEvent, TNotionSharedData } from '@monorepo/notion';

import { log } from '@monorepo/log';
import { TMyfetchRequest } from '@monorepo/simple-types';
import { ForwardException, myfetch } from '@monorepo/backend-engine';

import { CONFIG } from './config';
import { PROJECT } from './project-config';
import { ROOM_ID } from './main';
import { modules } from './modules';

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

/*

const gatewayStopNotify = async () => {
  log(6, 'GATEWAY', 'gatewayStopNotify');

  await toGanymede({
    url: '/gateway-stop',
    method: 'POST',
    headers: { authorization: CONFIG.GATEWAY_TOKEN },
  });
  saveDoc();
  runScript('reset-gateway');
};

*/
//
//

const chunks: TCollaborativeChunk[] = modules.map(
  (module) => module.collabChunk
);

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
  | TJupyterEvent
  | TSpaceEvent
  | TServerEvents
  | TChatEvent
  | TTabEvents<TabPayload>
  | TNotionEvent
  | TCollabNativeEvent;

//
//

export async function initProjectCollaboration(
  bep: BackendEventProcessor<TAllEvents, unknown>
) {
  // create Y document
  ydoc = u.getYDoc(ROOM_ID);

  const yst = new YjsSharedTypes(ydoc);
  const yse = new YjsSharedEditor(ydoc.getMap(EDITORS_YTEXT_YMAP_KEY));

  const ec = { project_id: PROJECT?.PROJECT_ID };
  const { sharedData, extraContext } = compileChunks(chunks, yst, { bep, extraContext: ec });

  // load data from saved file
  const loaded = loadDoc();
  const isNew = !loaded;

  // attach data to dispatcher
  bep.bindData(yst, yse, sharedData, {}, extraContext);

  // let every reducers update data from up to date data (API calls ...)
  await bep.process({ type: 'core:load' });

  //
  // new project initialization
  //

  const DEFAULT_VIEW_1 = 'view-1';

  if (isNew) {
    console.log('new project initialization');
    await bep.process({
      type: 'space:new-view',
      viewId: DEFAULT_VIEW_1,
    });
    await bep.process({
      type: 'tabs:add-tab',
      path: [],
      title: 'node-editor-1',
      payload: { type: 'node-editor', viewId: DEFAULT_VIEW_1 },
    });
    await bep.process({
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
      bep.process({
        type: 'user-leave',
        userId: userId,
        awarenessState: (ydoc as any).awareness.getStates().get(userId),
      });
    });
  });

  return { bep };
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

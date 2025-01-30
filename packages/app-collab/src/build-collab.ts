import * as Y from 'yjs';
const u = require('y-websocket/bin/utils');
import {
  Dispatcher,
  TCollabNativeEvent,
  TCollaborativeChunk,
  YjsSharedTypes,
  compileChunks,
} from '@monorepo/collab-engine';
import {
  TabPayload,
  TChatEvent,
  TDemiurgeNotebookEvent,
  TServerEvents,
  TTabEvents,
} from '@monorepo/demiurge-types';
import {
  Chat_loadData,
  Notebook_loadData,
  Space_loadData,
  Tabs_loadData,
  TChatSharedData,
  TCoreSharedData,
  TNotebookSharedData,
  TSpaceSharedData,
  TTabsSharedData,
} from '@monorepo/shared-data-model';
import { log } from '@monorepo/log';
import { loadCollaborationData } from './load-collab';
import { TMyfetchRequest, fullUri } from '@monorepo/simple-types';
import { DriversStoreBackend } from '@monorepo/jupyterlab-api';
import { WebsocketProvider } from 'y-websocket';
import { ForwardException, myfetch } from '@monorepo/backend-engine';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { PROJECT } from './project-config';
import { SelectionReducer } from './event-reducers/selections-reducer';
import {
  GraphViewsReducer,
  TDemiurgeSpaceEvent,
} from './event-reducers/graphviews-reducer';
import { ChatReducer } from './event-reducers/chat-reducer';
import { NotebookReducer } from './event-reducers/notebook-reducer';
import { MetaReducer } from './event-reducers/meta-reducer';
import { ProjectServerReducer } from './event-reducers/servers-reducer';
import { TabsReducer } from './event-reducers/tabs-reducer';
import { CONFIG } from './config';

//
//
//

const chunks: TCollaborativeChunk[] = [
  {
    initChunk: (st) => {
      const sharedData = Space_loadData(st);
      return {
        sharedData,
        reducers: [new SelectionReducer(), new GraphViewsReducer()],
      };
    },
  },
  {
    initChunk: (st) => {
      const sharedData = Chat_loadData(st);
      return {
        sharedData,
        reducers: [new ChatReducer()],
      };
    },
  },
  {
    initChunk: (st) => {
      const sharedData = Notebook_loadData(st);
      const dsb = new DriversStoreBackend(sharedData);
      return {
        sharedData,
        reducers: [
          new NotebookReducer(dsb),
          new ProjectServerReducer(),
          new MetaReducer(),
        ],
      };
    },
  },
  {
    initChunk: (st) => {
      const sharedData = Tabs_loadData(st);
      return {
        sharedData,
        reducers: [new TabsReducer()],
      };
    },
  },
];

//
//
//

export type TSd = TCoreSharedData &
  TNotebookSharedData &
  TSpaceSharedData &
  TChatSharedData &
  TTabsSharedData;

export type TAllEvents =
  | TDemiurgeNotebookEvent
  | TDemiurgeSpaceEvent
  | TServerEvents
  | TChatEvent
  | TTabEvents<TabPayload>
  | TCollabNativeEvent;

//
//

type WSSharedDoc = Y.Doc & {
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

  const loadChunks = compileChunks(chunks, dispatcher, {});

  const sd = loadChunks(yst) as TSd;

  dispatcher.bindData(yst, sd);

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
    project_id: PROJECT!.PROJECT_ID,
  };
  const response = await myfetch(request);
  if (response.statusCode !== 200)
    throw new ForwardException(request, response);

  return response.json as T;
};

//

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
    es.onmessage = (event: MessageEvent) =>
      onMessage(event, resolve, reject, es);
  });
};

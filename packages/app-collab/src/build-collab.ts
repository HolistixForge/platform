import * as Y from 'yjs';
const u = require('y-websocket/bin/utils');
import {
  Dispatcher,
  TCollabNativeEvent,
  TCollaborativeChunk,
  YjsSharedTypes,
  compileChunks,
} from '@monorepo/collaborative';
import {
  Chat_loadData,
  DemiurgeNotebook_loadData,
  DemiurgeSpace_loadData,
  TabPayload,
  Tabs_loadData,
  TChatEvent,
  TChatSharedData,
  TDemiurgeNotebookEvent,
  TDemiurgeNotebookSharedData,
  TDemiurgeSpaceEvent,
  TDemiurgeSpaceSharedData,
  TServerEvents,
  TTabEvents,
  TTabsSharedData,
} from '@monorepo/demiurge-types';
import { log } from '@monorepo/log';
import { loadCollaborationData } from './load-collab';
import { TMyfetchRequest, fullUri } from '@monorepo/simple-types';
import { DriversStoreBackend } from '@monorepo/jupyterlab-api';
import { WebsocketProvider } from 'y-websocket';
import { ForwardException, myfetch } from '@monorepo/backend-engine';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { PROJECT } from './project-config';
import { SelectionReducer } from './event-reducers/selections-reducer';
import { GraphViewsReducer } from './event-reducers/graphviews-reducer';
import { ChatReducer } from './event-reducers/chat-reducer';
import {
  NotebookReducer,
  TNotebookReducersExtraArgs,
} from './event-reducers/notebook-reducer';
import { MetaReducer } from './event-reducers/meta-reducer';
import { ProjectServerReducer } from './event-reducers/project-server-reducer';
import { TabsReducer } from './event-reducers/tabs-reducer';
import { CONFIG } from './config';

//
//
//

const chunks: TCollaborativeChunk[] = [
  {
    initChunk: (st) => {
      const sharedData = DemiurgeSpace_loadData(st);
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
      const sharedData = DemiurgeNotebook_loadData(st);
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

export type TSd = TDemiurgeNotebookSharedData &
  TDemiurgeSpaceSharedData &
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

class WSSharedDoc extends Y.Doc {
  awareness: WebsocketProvider['awareness'];
}

//
//

export async function initProjectCollaboration(
  dispatcher: Dispatcher<TAllEvents, TNotebookReducersExtraArgs>
) {
  const docId = PROJECT.YJS_DOC_ID;
  log(6, 'YJS', `Creating Yjs doc: [${docId}]`);
  const ydoc: WSSharedDoc = u.getYDoc(docId);

  const yst = new YjsSharedTypes(ydoc);

  const loadChunks = compileChunks(chunks, dispatcher, {});

  const sd = loadChunks(yst) as TSd;

  dispatcher.bindData(yst, sd);

  ydoc.awareness.on('change', ({ removed }) => {
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
    project_id: PROJECT?.PROJECT_ID,
  };
  const response = await myfetch(request);
  if (response.statusCode !== 200)
    throw new ForwardException(request, response);

  return response.json as T;
};

//

export const toGanymedeEventSource = async (
  request: TMyfetchRequest,
  onMessage: (event, resolve, reject, es: EventSourcePolyfill) => void
): Promise<void> => {
  if (!request.url.startsWith('/')) request.url = `/${request.url}`;
  request.url = `${ganymede_api}${request.url}`;
  request.pathParameters = {
    ...request.pathParameters,
    project_id: PROJECT?.PROJECT_ID,
  };
  const fu = fullUri(request);

  await new Promise((resolve, reject) => {
    const es = new EventSourcePolyfill(fu, {
      headers: request.headers,
    });
    es.onmessage = (event) => onMessage(event, resolve, reject, es);
  });
};

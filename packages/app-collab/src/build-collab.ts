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
  Core_loadData,
  Jupyter_loadData,
  Servers_loadData,
  Space_loadData,
  Tabs_loadData,
  TChatSharedData,
  TCoreSharedData,
  TServersSharedData,
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
import { JupyterReducer } from './event-reducers/jupyter-reducer';
import { MetaReducer } from './event-reducers/meta-reducer';
import { ProjectServerReducer } from './event-reducers/servers-reducer';
import { TabsReducer } from './event-reducers/tabs-reducer';
import { CONFIG } from './config';
import {
  CoreReducer,
  TCoreEvent,
} from '../../modules/core/src/lib/core-reducer';

//
//
//

const chunks: TCollaborativeChunk[] = [
  {
    initChunk: (st) => {
      return {
        sharedData: Core_loadData(st),
        reducers: [new CoreReducer(), new MetaReducer()],
      };
    },
  },
  {
    initChunk: (st) => {
      return {
        sharedData: Space_loadData(st),
        reducers: [new SelectionReducer(), new GraphViewsReducer()],
      };
    },
  },
  {
    initChunk: (st) => {
      return {
        sharedData: Chat_loadData(st),
        reducers: [new ChatReducer()],
      };
    },
  },
  {
    initChunk: (st) => {
      return {
        sharedData: Servers_loadData(st),
        reducers: [new ProjectServerReducer()],
      };
    },
  },
  {
    initChunk: (st) => {
      return {
        sharedData: Tabs_loadData(st),
        reducers: [new TabsReducer()],
      };
    },
  },
  {
    initChunk: (st) => {
      const sharedData = Jupyter_loadData(st);
      const dsb = new DriversStoreBackend(sharedData.projectServers as any);
      return {
        sharedData,
        reducers: [new JupyterReducer(dsb)],
      };
    },
  },
];

//
//
//

export type TSd = TCoreSharedData &
  TServersSharedData &
  TSpaceSharedData &
  TChatSharedData &
  TTabsSharedData;

export type TAllEvents =
  | TCoreEvent
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
    es.onmessage = (event: any) => onMessage(event, resolve, reject, es);
  });
};

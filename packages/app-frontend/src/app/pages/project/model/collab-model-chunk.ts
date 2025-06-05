import {
  useDispatcher as useDispatcherCollab,
  useSharedData as useSharedDataCollab,
  SharedTypes,
  TCollaborativeChunk,
  TValidSharedDataToCopy,
} from '@monorepo/collab-engine';
import { Core_loadData, TCoreSharedData, TCoreEvent } from '@monorepo/core';
import {
  TabPayload,
  TTabEvents,
  Tabs_loadData,
  TTabsSharedData,
} from '@monorepo/tabs';
import { Space_loadData, TSpaceSharedData, TSpaceEvent } from '@monorepo/space';
import { TChatEvent, Chat_loadData, TChatSharedData } from '@monorepo/chats';
import {
  TServerEvents,
  Servers_loadData,
  TServersSharedData,
  TServer,
} from '@monorepo/servers';
import { TDemiurgeNotebookEvent, TJupyterSharedData } from '@monorepo/jupyter';
import { module as jupyterModule } from '@monorepo/jupyter/frontend';
import { TEventSocials } from '@monorepo/socials';
import { Notion_loadData, TNotionEvent } from '@monorepo/notion';

//

export type AllSharedData = TCoreSharedData &
  TTabsSharedData &
  TSpaceSharedData &
  TServersSharedData &
  TJupyterSharedData &
  TChatSharedData;

type AllEvents =
  | TCoreEvent
  | TSpaceEvent
  | TServerEvents
  | TDemiurgeNotebookEvent
  | TTabEvents<TabPayload>
  | TChatEvent
  | TEventSocials
  | TNotionEvent;

export const useDispatcher = useDispatcherCollab<AllEvents>;

//
/*
const getToken = async (server: TServer, serviceName: string) => {
  const oauth_client = server.oauth.find(
    (o) => o.service_name === 'jupyterlab'
  );
  if (!oauth_client) throw new Error('jupyterlab not mapped');

  let v;
  do {
    v = ganymedeApi._ts.get({
      client_id: oauth_client.client_id,
    });
    if (v.promise) await v.promise;
  } while (!v.value);

  return v.value.token.access_token;
};
*/

export const getCollabChunks = (): TCollaborativeChunk[] => {
  //
  return [
    {
      name: 'core',
      loadSharedData: (st: SharedTypes) => Core_loadData(st),
    },
    {
      name: 'space',
      loadSharedData: (st: SharedTypes) => Space_loadData(st),
    },
    {
      name: 'chats',
      loadSharedData: (st: SharedTypes) => Chat_loadData(st),
    },
    {
      name: 'servers',
      loadSharedData: (st: SharedTypes) => Servers_loadData(st),
    },
    {
      name: 'tabs',
      loadSharedData: (st: SharedTypes) => Tabs_loadData(st),
    },
    jupyterModule.collabChunk,
    {
      name: 'notion',
      loadSharedData: (st: SharedTypes) => Notion_loadData(st),
    },
  ];
};

//

export const useSharedData: (
  deps: (keyof AllSharedData)[],
  f: (data: TValidSharedDataToCopy<AllSharedData>) => any
) => ReturnType<typeof f> = useSharedDataCollab<AllSharedData>;

//

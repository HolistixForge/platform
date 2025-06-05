import {
  useDispatcher as useDispatcherCollab,
  useSharedData as useSharedDataCollab,
  SharedTypes,
  TCollaborativeChunk,
  TValidSharedData,
  TValidSharedDataToCopy,
  FrontendDispatcher,
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
} from '@monorepo/servers';
import {
  TDemiurgeNotebookEvent,
  TJupyterSharedData,
  Jupyter_loadData,
} from '@monorepo/jupyter';
import { Jupyter_Load_Frontend_ExtraContext } from '@monorepo/jupyter/frontend';
import { GanymedeApi } from '@monorepo/frontend-data';
import { TEventSocials } from '@monorepo/socials';
import { Notion_loadData, TNotionEvent } from '@monorepo/notion';
import { TJsonObject } from '@monorepo/simple-types';

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

export const getCollabChunks = (
  ganymedeApi: GanymedeApi,
  dispatcher: FrontendDispatcher<TJsonObject>
): TCollaborativeChunk[] => {
  //
  return [
    {
      sharedData: (st: SharedTypes) => Core_loadData(st),
    },
    {
      sharedData: (st: SharedTypes) => Space_loadData(st),
    },
    {
      sharedData: (st: SharedTypes) => Chat_loadData(st),
    },
    {
      sharedData: (st: SharedTypes) => Servers_loadData(st),
    },
    {
      sharedData: (st: SharedTypes) => Tabs_loadData(st),
    },
    {
      sharedData: (st: SharedTypes) => Jupyter_loadData(st),
      extraContext: (sd: TValidSharedData) =>
        Jupyter_Load_Frontend_ExtraContext(
          sd as TJupyterSharedData & TServersSharedData,
          dispatcher,
          // getToken callback
          async (server) => {
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
          }
        ),
    },
    {
      sharedData: (st: SharedTypes) => Notion_loadData(st),
    },
  ];
};

//

export const useSharedData: (
  deps: (keyof AllSharedData)[],
  f: (data: TValidSharedDataToCopy<AllSharedData>) => any
) => ReturnType<typeof f> = useSharedDataCollab<AllSharedData>;

//

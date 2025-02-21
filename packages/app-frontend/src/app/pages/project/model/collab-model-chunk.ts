import {
  TSharedDataHook,
  useDispatcher as useDispatcherCollab,
  useSharedData as useSharedDataCollab,
  SharedTypes,
  TCollaborativeChunk,
  TValidSharedData,
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

//

type AllSharedData = TCoreSharedData &
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
  | TEventSocials;

export const useDispatcher = useDispatcherCollab<AllEvents>;

//

export const getCollabChunks = (
  ganymedeApi: GanymedeApi
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
  ];
};

//

export const useSharedData: TSharedDataHook<AllSharedData> =
  useSharedDataCollab<AllSharedData>;

//

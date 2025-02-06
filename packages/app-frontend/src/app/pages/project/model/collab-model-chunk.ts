import { useCallback, useEffect, useState } from 'react';

import { GanymedeApi } from '@monorepo/frontend-data';
import {
  TAwarenessUser,
  TSharedDataHook,
  useDispatcher as useDispatcherCollab,
  useExtraContext,
  useSharedData as useSharedDataCollab,
  SharedTypes,
  TCollaborativeChunk,
  TValidSharedData,
} from '@monorepo/collab-engine';
import { serverUrl } from '@monorepo/api-fetch';
import { TServer } from '@monorepo/servers';
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
  injectWidgetsScripts,
  TDKID,
} from '@monorepo/jupyter';

import { JLsManager, TKernelPack } from '../jl-integration/jls-manager';

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
  | TChatEvent;

export const useDispatcher = useDispatcherCollab<AllEvents>;

//

export const getCollabChunks = ({
  gatewayFQDN,
  api,
  user,
}: {
  gatewayFQDN: string;
  api: GanymedeApi;
  user: TAwarenessUser;
}): TCollaborativeChunk[] => {
  //
  return [
    {
      sharedData: (st: SharedTypes) => Core_loadData(st),
      reducers: (sd: TValidSharedData) => [],
    },
    {
      sharedData: (st: SharedTypes) => Space_loadData(st),
      reducers: (sd: TValidSharedData) => [],
    },
    {
      sharedData: (st: SharedTypes) => Chat_loadData(st),
      reducers: (sd: TValidSharedData) => [],
    },
    {
      sharedData: (st: SharedTypes) => Servers_loadData(st),
      reducers: (sd: TValidSharedData) => [],
    },
    {
      sharedData: (st: SharedTypes) => Tabs_loadData(st),
      reducers: (sd: TValidSharedData) => [],
    },
    {
      sharedData: (st: SharedTypes) => Jupyter_loadData(st),
      reducers: (sd: TValidSharedData) => [],
      extraContext: (sd: TValidSharedData) => {
        const onNewServer = (server: TServer) => {
          if (server.type === 'jupyter') {
            const service = server.httpServices.find(
              (srv) => srv.name === 'jupyterlab'
            );
            if (service) {
              injectWidgetsScripts(
                serverUrl({
                  host: gatewayFQDN,
                  location: service.location,
                })
              );
            }
          }
          return Promise.resolve();
        };

        const jlsManager = new JLsManager(
          sd,
          api,
          gatewayFQDN,
          onNewServer,
          user
        );

        return { jlsManager };
      },
    },
  ];
};

//

export const useSharedData: TSharedDataHook<AllSharedData> =
  useSharedDataCollab<AllSharedData>;

//

export const useJLsManager = () =>
  useExtraContext<{ jlsManager: JLsManager }>();

//

export const useKernelPack = (dkid: TDKID): TKernelPack => {
  const { jlsManager } = useJLsManager();

  const [, _update] = useState({});

  const update = useCallback(() => _update({}), []);

  const kernelPack = jlsManager.getKernelPack(dkid);

  useEffect(() => {
    jlsManager.addListener(dkid, update);
    return () => {
      jlsManager.removeListener(dkid, update);
    };
  }, [dkid, jlsManager, update]);

  return (
    kernelPack || {
      project_server_id: -1,
      dkid,
      state: 'server-stopped',
      progress: 0,
      widgetManager: null,
      listeners: [],
    }
  );
};

import {
  SharedTypes,
  TAwarenessUser,
  TCollaborativeChunk,
} from '@monorepo/collaborative';
import {
  TSharedDataHook,
  useDispatcher as useDispatcherCollab,
  useExtraContext,
  useSharedData as useSharedDataCollab,
} from '@monorepo/collaborative-hooks';
import {
  Chat_loadData,
  DemiurgeNotebook_loadData,
  TChatEvent,
  TChatSharedData,
  TDKID,
  TDemiurgeNotebookEvent,
  TDemiurgeNotebookSharedData,
  TDemiurgeSpaceEvent,
  TJupyterServerInfo,
  TServerEvents,
  TTabEvents,
  TTabsSharedData,
  TabPayload,
  Tabs_loadData,
  serverUrl,
} from '@monorepo/demiurge-types';
import { injectWidgetsScripts } from '@monorepo/jupyterlab-api-browser';
import { JLsManager, TKernelPack } from '../jl-integration/jls-manager';
import { useCallback, useEffect, useState } from 'react';
import { GanymedeApi } from '@monorepo/demiurge-data';

//
//

export const DemiurgeNotebookCollabChunk = ({
  gatewayFQDN,
  api,
  user,
}: {
  gatewayFQDN: string;
  api: GanymedeApi;
  user: TAwarenessUser;
}): TCollaborativeChunk => ({
  initChunk: (st: SharedTypes) => {
    const sharedData = DemiurgeNotebook_loadData(st);

    const onNewServer = (server: TJupyterServerInfo) => {
      if (server.type === 'jupyter') {
        const service = server.httpServices.find(
          (srv) => srv.name === 'jupyterlab',
        );
        if (service) {
          injectWidgetsScripts(
            serverUrl({
              host: gatewayFQDN,
              location: service.location,
            }),
          );
        }
      }
      return Promise.resolve();
    };

    const jlsManager = new JLsManager(
      sharedData,
      api,
      gatewayFQDN,
      onNewServer,
      user,
    );

    return {
      sharedData,
      reducers: [],
      extraContext: { jlsManager },
    };
  },
});

//
//
//

export const ChatCollabChunk: TCollaborativeChunk = {
  initChunk: (st: SharedTypes) => {
    const sharedData = Chat_loadData(st);
    return { sharedData, reducers: [], extraContext: {} };
  },
};

//
//
//

export const TabsCollabChunk: TCollaborativeChunk = {
  initChunk: (st: SharedTypes) => {
    const sharedData = Tabs_loadData(st);
    return { sharedData, reducers: [], extraContext: {} };
  },
};

//
//

export const useDispatcher = useDispatcherCollab<
  | TDemiurgeNotebookEvent
  | TChatEvent
  | TDemiurgeSpaceEvent
  | TServerEvents
  | TTabEvents<TabPayload>
>;

type AllSharedData = TDemiurgeNotebookSharedData &
  TChatSharedData &
  TTabsSharedData;

export const useSharedData: TSharedDataHook<AllSharedData> =
  useSharedDataCollab<AllSharedData>;

//
//
//
//
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

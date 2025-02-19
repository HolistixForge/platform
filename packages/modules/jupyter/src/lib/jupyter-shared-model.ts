import { useCallback, useEffect, useState } from 'react';

import {
  SharedMap,
  SharedTypes,
  useExtraContext,
} from '@monorepo/collab-engine';
import { TServer, TServersSharedData } from '@monorepo/servers';

import { TJupyterServerData, TCell, TDKID } from './jupyter-types';
import { JLsManager, TKernelPack } from './front/jls-manager';

//

export type TJupyterSharedData = {
  jupyterServers: SharedMap<TJupyterServerData>;
  cells: SharedMap<TCell>;
};

//

export const Jupyter_loadData = (st: SharedTypes): TJupyterSharedData => {
  return {
    jupyterServers: st.getSharedMap('plugin-jupyter-servers'),
    cells: st.getSharedMap('plugin-jupyter-cells'),
  };
};

//

export const Jupyter_Load_Frontend_ExtraContext = (
  sd: TJupyterSharedData & TServersSharedData,
  getToken: (s: TServer) => Promise<string>
): { jlsManager: JLsManager } => {
  return {
    jlsManager: new JLsManager(sd, getToken),
  };
};

//

export const useJLsManager = () =>
  useExtraContext<{ jlsManager: JLsManager }>();

//

export const useKernelPack = (dkid: TDKID): TKernelPack => {
  const [kernelPack, setKernelPack] = useState<TKernelPack | undefined>(
    undefined
  );
  const { jlsManager } = useJLsManager();

  const [, _update] = useState({});
  const update = useCallback(() => _update({}), []);

  useEffect(() => {
    jlsManager.getKernelPack(dkid).then((kp) => {
      setKernelPack(kp);
      jlsManager.addListener(dkid, update);
    });

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

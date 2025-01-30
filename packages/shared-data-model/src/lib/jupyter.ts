import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TJupyterServerData } from '@monorepo/jupyterlab-api';

export type TJupyterSharedData = {
  projectServers: SharedMap<TJupyterServerData>;
};

export const Jupyter_loadData = (st: SharedTypes): TJupyterSharedData => {
  return {
    projectServers: st.getSharedMap('plugin-jupyter'),
  };
};

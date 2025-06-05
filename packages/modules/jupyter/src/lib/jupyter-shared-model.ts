import { SharedMap, SharedTypes } from '@monorepo/collab-engine';

import { TJupyterServerData } from './jupyter-types';

//

export type TJupyterSharedData = {
  jupyterServers: SharedMap<TJupyterServerData>;
};

//

export const Jupyter_loadData = (st: SharedTypes): TJupyterSharedData => {
  return {
    jupyterServers: st.getSharedMap('plugin-jupyter-servers'),
  };
};

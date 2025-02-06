import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TJupyterServerData, TCell } from './jupyter-types';

export type TJupyterSharedData = {
  jupyterServers: SharedMap<TJupyterServerData>;
  cells: SharedMap<TCell>;
};

export const Jupyter_loadData = (st: SharedTypes): TJupyterSharedData => {
  return {
    jupyterServers: st.getSharedMap('plugin-jupyter-servers'),
    cells: st.getSharedMap('plugin-jupyter-cells'),
  };
};

import { SharedMap } from '@holistix-forge/collab-engine';

import { TJupyterServerData } from './jupyter-types';

//

export type TJupyterSharedData = {
  'jupyter:servers': SharedMap<TJupyterServerData>;
};

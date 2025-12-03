import { SharedMap } from '@holistix/collab-engine';

import { TJupyterServerData } from './jupyter-types';

//

export type TJupyterSharedData = {
  'jupyter:servers': SharedMap<TJupyterServerData>;
};

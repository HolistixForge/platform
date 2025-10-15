import type { TModule } from '@monorepo/module';
import type { TCollabBackendExports } from '@monorepo/collab';
import type { TReducersBackendExports } from '@monorepo/reducers';
import { TCollabFrontendExports } from '@monorepo/collab/frontend';

import { CoreReducer } from './lib/core-reducer';
import { TCoreSharedData } from './lib/core-types';

type TBackendRequired = {
  collab: TCollabBackendExports<TCoreSharedData>;
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TBackendRequired> = {
  name: 'core-graph',
  version: '0.0.1',
  description: 'Core module',
  dependencies: ['collab', 'reducers'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'core-graph', 'nodes');
    depsExports.collab.collab.loadSharedData('array', 'core-graph', 'edges');

    depsExports.reducers.loadReducers(new CoreReducer(depsExports));
  },
};

//

export type TFrontendRequired = {
  collab: TCollabFrontendExports;
};

export const moduleFrontend: TModule<TFrontendRequired> = {
  name: 'core-graph',
  version: '0.0.1',
  description: 'Core module',
  dependencies: ['collab'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'core-graph', 'nodes');
    depsExports.collab.collab.loadSharedData('array', 'core-graph', 'edges');
  },
};

export type {
  TPosition,
  TEdge,
  TEdgeEnd,
  EEdgeSemanticType,
  TGraphNode,
  TConnector,
  TPin,
} from './lib/core-types';

export type { TCoreSharedData } from './lib/core-types';
export { useNodeEdges } from './lib/core-hooks';

export type {
  TEventDeleteEdge,
  TEventDeleteNode,
  TEventNewEdge,
  TEventNewNode,
  TEventOrigin,
  TCoreEvent,
} from './lib/core-events';

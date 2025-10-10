import type { TModule } from '@monorepo/module';
import type { TCollabBackendExports } from '@monorepo/collab';
import type { TReducersBackendExports } from '@monorepo/reducers';
import { CoreReducer } from './lib/core-reducer';

type TRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TRequired, undefined> = {
  name: 'core-graph',
  version: '0.0.1',
  description: 'Core module',
  dependencies: ['collab', 'reducers'],
  load: ({ depsExports, moduleExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'nodes');
    depsExports.collab.collab.loadSharedData('array', 'edges');

    depsExports.reducers.loadReducers(new CoreReducer());
  },
};

export const moduleFrontend: TModule<TRequired, undefined> = {
  name: 'core-graph',
  version: '0.0.1',
  description: 'Core module',
  dependencies: ['collab'],
  load: ({ depsExports, moduleExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'nodes');
    depsExports.collab.collab.loadSharedData('array', 'edges');
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

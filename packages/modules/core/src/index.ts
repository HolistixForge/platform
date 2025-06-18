import { Core_loadData } from './lib/core-shared-model';
import { CoreReducer } from './lib/core-reducer';
import { MetaReducer } from './lib/meta-reducer';
import type { ModuleBackend } from '@monorepo/module';
import { ModuleFrontend } from '@monorepo/module/frontend';

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'core',
    loadSharedData: Core_loadData,
    loadReducers: (sd) => [
      new CoreReducer(),
      new MetaReducer(() => {
        throw new Error('gatewayStopNotify not implemented');
      }),
    ],
    deps: ['gateway'], // gatewayStopNotify
  },
};

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'core',
    loadSharedData: Core_loadData,
    deps: [],
  },
  spaceMenuEntries: () => [],
  nodes: {},
};

export type {
  TPosition,
  TEdge,
  TEdgeEnd,
  EEdgeSemanticType,
  TProjectMeta,
} from './lib/core-types';

export type { TCoreSharedData } from './lib/core-shared-model';
export { useNodeEdges } from './lib/core-shared-model';

export type {
  TEventDeleteEdge,
  TEventDeleteNode,
  TEventNewEdge,
  TEventNewNode,
  TEventOrigin,
  TCoreEvent,
  TEventLoad,
} from './lib/core-events';

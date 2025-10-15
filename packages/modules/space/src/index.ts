import type { TModule } from '@monorepo/module';
import { SharedMap } from '@monorepo/collab-engine';

import { SpaceReducer } from './lib/space-reducer';
import { TGraphView } from './lib/space-types';
import { TCollabBackendExports } from '@monorepo/collab';
import { TReducersBackendExports } from '@monorepo/reducers';
import { TGatewayExports } from '@monorepo/gateway';
import { TCoreSharedData } from '@monorepo/core-graph';

export type TSpaceSharedData = {
  'space:graphViews': SharedMap<TGraphView>;
};

type TRequired = {
  collab: TCollabBackendExports<TSpaceSharedData & TCoreSharedData>;
  reducers: TReducersBackendExports;
  gateway: TGatewayExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'space',
  version: '0.0.1',
  description: 'Space module',
  dependencies: ['core-graph', 'gateway'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'space', 'graphViews');
    depsExports.reducers.loadReducers(new SpaceReducer(depsExports));
  },
};

export { nodeViewDefaultStatus, defaultGraphView } from './lib/space-types';

export type { TNodeView } from './lib/space-types';

export type {
  TSpaceEvent,
  TEventNewView,
  TEventNewGroup,
  TEventNewShape,
  TEventShapePropertyChange,
  TEventLockNode,
  TEventDisableFeature,
} from './lib/space-events';

export { SHAPE_TYPES } from './lib/space-events';

import type { TModule } from '@holistix-forge/module';
import { SharedMap } from '@holistix-forge/collab-engine';

import { WhiteboardReducer } from './lib/whiteboard-reducer';
import { TGraphView } from './lib/whiteboard-types';
import { TCollabBackendExports } from '@holistix-forge/collab';
import { TReducersBackendExports } from '@holistix-forge/reducers';
import { TGatewayExports } from '@holistix-forge/gateway';
import { TCoreSharedData } from '@holistix-forge/core-graph';

export type TWhiteboardSharedData = {
  'whiteboard:graphViews': SharedMap<TGraphView>;
};

type TRequired = {
  collab: TCollabBackendExports<TWhiteboardSharedData & TCoreSharedData>;
  reducers: TReducersBackendExports;
  gateway: TGatewayExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'whiteboard',
  version: '0.0.1',
  description: 'Whiteboard module',
  dependencies: ['core-graph', 'gateway'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'whiteboard', 'graphViews');
    depsExports.reducers.loadReducers(new WhiteboardReducer(depsExports));
  },
};

export { nodeViewDefaultStatus, defaultGraphView } from './lib/whiteboard-types';

export type { TNodeView } from './lib/whiteboard-types';

export type {
  TWhiteboardEvent,
  TEventNewView,
  TEventNewGroup,
  TEventNewShape,
  TEventShapePropertyChange,
  TEventLockNode,
  TEventDisableFeature,
} from './lib/whiteboard-events';

export { SHAPE_TYPES } from './lib/whiteboard-events';

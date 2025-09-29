import { Space_loadData } from './lib/space-shared-model';
import { SpaceReducer } from './lib/space-reducer';
import type { ModuleBackend } from '@monorepo/module';

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'space',
    loadSharedData: Space_loadData,
    loadReducers: (sd) => [new SpaceReducer()],
    deps: ['core'],
  },
};

export type { TSpaceSharedData } from './lib/space-shared-model';

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

import './lib/index.scss';

export type { TSpaceSharedData } from './lib/space-shared-model';

export { Space_loadData } from './lib/space-shared-model';

export { SpaceReducer } from './lib/space-reducer';

export {
  DisableZoomDragPan,
  NodeMainToolbar,
  InputsAndOutputs,
  Outputs,
  Inputs,
  useMakeButton,
  NodeHeader,
  useTestToolbarButtons,
  useConnector,
  useNodeContext,
  LabelEnd,
  LabelMiddle,
  LabelStart,
  EdgeComponent,
  Group,
  Shape,
  MockSpace,
} from './lib/components';

export type { TNodeContext } from './lib/components';
export { nodeViewDefaultStatus, defaultGraphView } from './lib/space-types';

export type { TNodeView } from './lib/space-types';

export type {
  TSpaceEvent,
  TEventNewView,
  TEventNewGroup,
  TEventNewShape,
  TEventShapePropertyChange,
} from './lib/space-events';

export { SHAPE_TYPES } from './lib/space-events';

export { SpaceModule } from './lib/components/collab-module/main';

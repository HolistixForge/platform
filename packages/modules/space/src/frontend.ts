import { ModuleFrontend } from '@monorepo/module/frontend';

import { Group } from './lib/components/group/group';
import { Shape } from './lib/components/shape/shape';
import { Space_loadData } from './lib/space-shared-model';
import { spaceMenuEntries } from './lib/space-menu';
import './lib/index.scss';

export {
  InputsAndOutputs,
  Outputs,
  Inputs,
} from './lib/components/assets/inputsOutputs/inputsOutputs';
export { EdgeComponent } from './lib/components/assets/edges/edge';
export { DisableZoomDragPan } from './lib/components/node-wrappers/disable-zoom-drag-pan';
export { NodeMainToolbar } from './lib/components/assets/node-header/node-main-toolbar';
export { NodeHeader } from './lib/components/assets/node-header/node-header';
export {
  useMakeButton,
  useNodeHeaderButtons,
} from './lib/components/assets/node-header/node-main-toolbar';
export { useTestToolbarButtons } from './lib/components/assets/node-header/node-main-toolbar';
export { useConnector } from './lib/components/assets/inputsOutputs/inputsOutputs';
export { useNodeContext } from './lib/components/node-wrappers/node-wrapper';
export {
  LabelEnd,
  LabelMiddle,
  LabelStart,
} from './lib/components/assets/edges/edge';

export type { TNodeContext } from './lib/components/apis/types/node';

export { HolistixSpace } from './lib/components/holistix-space';

export { useLayerContext } from './lib/components/layer-context';

//

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'space',
    loadSharedData: Space_loadData,
    deps: ['core'],
  },
  spaceMenuEntries,
  nodes: {
    group: Group,
    shape: Shape,
  },
};

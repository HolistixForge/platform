import './lib/index.scss';
import { Space_loadData } from './lib/space-shared-model';
import { Group, Shape } from './lib/components';
import { ModuleFrontend } from '@monorepo/module/frontend';

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
  MockSpace,
} from './lib/components';

export type { TNodeContext } from './lib/components';

export { SpaceModule } from './lib/components/collab-module/main';

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'space',
    loadSharedData: Space_loadData,
    deps: ['core'],
  },
  spaceMenuEntries: [],
  nodes: {
    group: Group,
    shape: Shape,
  },
};

//

export { STORY_VIEW_ID, StorySpace } from './lib/stories/story-space';

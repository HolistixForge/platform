import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Logger } from '@monorepo/log';
import { loadModules, TModule } from '@monorepo/module';
import { ModuleProvider } from '@monorepo/module/frontend';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@monorepo/core-graph';
import {
  moduleBackend as collabBackend,
  TCollabBackendExports,
} from '@monorepo/collab';
import { moduleFrontend as collabFrontend } from '@monorepo/collab/frontend';
import { moduleBackend as reducersBackend } from '@monorepo/reducers';
import { moduleFrontend as reducersFrontend } from '@monorepo/reducers/frontend';
import { TCoreSharedData } from '@monorepo/core-graph';

import { HolistixSpace } from '../../components/holistix-space';
import { STORY_VIEW_ID } from '../story-holistix-space';
import { loadStoryData } from './loader';

import { moduleBackend as spaceBackend, TSpaceSharedData } from '../../..';
import { moduleFrontend as spaceFrontend } from '../../../frontend';

//

Logger.setPriority(7);

const initModule: TModule<
  { collab: TCollabBackendExports<TSpaceSharedData & TCoreSharedData> },
  object
> = {
  name: 'story-init',
  version: '0.0.1',
  description: 'Story init module',
  dependencies: ['collab'],
  load: ({ depsExports }) => {
    loadStoryData(depsExports.collab.collab.sharedData);
  },
};

const collabConfig = {
  type: 'none',
  room_id: 'space-story',
  simulateUsers: true,
  user: { username: 'test', color: 'red' },
};

const modulesBackend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabBackend,
    config: collabConfig,
  },
  { module: reducersBackend, config: {} },
  { module: coreBackend, config: {} },
  {
    module: {
      name: 'gateway',
      version: '0.0.1',
      description: 'Gateway module',
      dependencies: ['collab', 'reducers'],
      load: () => {
        //
      },
    },
    config: {},
  },
  { module: spaceBackend, config: {} },
  {
    module: initModule,
    config: {},
  },
];

const modulesFrontend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabFrontend,
    config: collabConfig,
  },
  { module: reducersFrontend, config: {} },
  { module: coreFrontend, config: {} },
  { module: spaceFrontend, config: {} },
];

//

const StoryWrapper = () => {
  const backendModules = useMemo(() => loadModules(modulesBackend), []);
  const frontendModules = useMemo(() => loadModules(modulesFrontend), []);

  return (
    <ModuleProvider exports={frontendModules}>
      <div style={{ height: '100vh', width: '100vw' }}>
        <HolistixSpace viewId={STORY_VIEW_ID} />
      </div>
    </ModuleProvider>
  );
};

//

const meta = {
  title: 'Modules/Space/Main',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Default: Story = {
  args: {},
};

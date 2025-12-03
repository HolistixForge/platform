import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Logger } from '@holistix/log';

//
import { loadModules, TModule } from '@holistix/module';
import { ModuleProvider } from '@holistix/module/frontend';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@holistix/core-graph';
import {
  moduleBackend as collabBackend,
  TCollabBackendExports,
} from '@holistix/collab';
import { moduleFrontend as collabFrontend } from '@holistix/collab/frontend';
import {
  moduleBackend as reducersBackend,
  TReducersBackendExports,
} from '@holistix/reducers';
import {
  moduleFrontend as reducersFrontend,
  linkDispatchToProcessEvent,
  TReducersFrontendExports,
} from '@holistix/reducers/frontend';
//

import { TCoreSharedData } from '@holistix/core-graph';

import { DemiurgeSpace } from '../../components/demiurge-space';
import { STORY_VIEW_ID } from '../story-demiurge-space';
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
  const { frontendModules } = useMemo(() => {
    const backendModules = loadModules(modulesBackend);
    const frontendModules = loadModules(modulesFrontend);

    linkDispatchToProcessEvent(
      backendModules as { reducers: TReducersBackendExports },
      frontendModules as { reducers: TReducersFrontendExports }
    );

    return { backendModules, frontendModules };
  }, []);

  return (
    <ModuleProvider exports={frontendModules}>
      <div style={{ height: '100vh', width: '100vw' }}>
        <DemiurgeSpace viewId={STORY_VIEW_ID} />
      </div>
    </ModuleProvider>
  );
};

//

const meta = {
  title: 'Modules/Space/Main',
  component: StoryWrapper,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Default: Story = {
  args: {},
};

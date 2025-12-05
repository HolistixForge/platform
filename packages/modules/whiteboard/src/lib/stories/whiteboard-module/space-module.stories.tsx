import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { EPriority, Logger } from '@holistix-forge/log';

//
import { loadModules, TModule } from '@holistix-forge/module';
import { ModuleProvider } from '@holistix-forge/module/frontend';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@holistix-forge/core-graph';
import {
  moduleBackend as collabBackend,
  TCollabBackendExports,
} from '@holistix-forge/collab';
import { moduleFrontend as collabFrontend } from '@holistix-forge/collab/frontend';
import {
  moduleBackend as reducersBackend,
  TReducersBackendExports,
} from '@holistix-forge/reducers';
import {
  moduleFrontend as reducersFrontend,
  linkDispatchToProcessEvent,
  TReducersFrontendExports,
} from '@holistix-forge/reducers/frontend';
//

import { TCoreSharedData } from '@holistix-forge/core-graph';

import { Whiteboard } from '../../components/whiteboard';
import { STORY_VIEW_ID } from '../story-whiteboard';
import { loadStoryData } from './loader';

import { moduleBackend as spaceBackend, TWhiteboardSharedData } from '../../..';
import { moduleFrontend as spaceFrontend } from '../../../frontend';

//

Logger.setPriority(EPriority.Debug);

const initModule: TModule<
  { collab: TCollabBackendExports<TWhiteboardSharedData & TCoreSharedData> },
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
  room_id: 'whiteboard-story',
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
        <Whiteboard viewId={STORY_VIEW_ID} projectId={'story-project'} />
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

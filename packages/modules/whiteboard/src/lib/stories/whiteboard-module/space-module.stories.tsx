import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { EPriority, Logger } from '@holistix-forge/log';

//
import { loadModules, TModule } from '@holistix-forge/module';
import { ModuleProvider } from '@holistix-forge/module/frontend';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
  TCoreSharedData,
} from '@holistix-forge/core-graph';
import {
  moduleBackend as collabBackend,
  createLocalCollabRegistry,
  TCollabBackendExports,
  Collab,
} from '@holistix-forge/collab';
import {
  moduleFrontend as collabFrontend,
  CollabProjectProvider,
} from '@holistix-forge/collab/frontend';
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

import { Whiteboard } from '../../components/whiteboard';
import { STORY_VIEW_ID } from '../story-whiteboard';
import { loadStoryData } from './loader';

import { moduleBackend as spaceBackend, TWhiteboardSharedData } from '../../..';
import { moduleFrontend as spaceFrontend } from '../../../frontend';

//

Logger.setPriority(EPriority.Debug);

const initModule: TModule<{ collab: TCollabBackendExports }, object> = {
  name: 'story-init',
  version: '0.0.1',
  description: 'Story init module',
  dependencies: ['collab'],
  load: ({ depsExports }) => {
    const collab =
      depsExports.collab.registry.getCollabForProject('story-project');
    loadStoryData(collab as Collab<TWhiteboardSharedData & TCoreSharedData>);
  },
};

const STORY_PROJECT_ID = 'story-project';

const collabConfig = {
  type: 'none' as const,
  room_id: 'whiteboard-story',
  simulateUsers: true,
  user: { user_id: 'story-user', username: 'test', color: 'red' },
};

// The frontend collab module takes the registry config; the backend still takes
// the plain one. Wrapping rather than replacing keeps both honest, and the
// factory hands back the same local document for every project — a story has
// exactly one.
const collabFrontendConfig = {
  type: 'registry' as const,
  createConfigForProject: () => collabConfig,
};

// The backend collab module re-exports whatever registry it is handed, and
// core-graph reads it during its own load. Handing it nothing is what killed
// these stories.
const collabBackendConfig = {
  registry: createLocalCollabRegistry(collabConfig),
};

const modulesBackend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabBackend,
    config: collabBackendConfig,
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
    config: collabFrontendConfig,
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

    // The dispatcher refuses to send without one, and says so — "No project_id
    // set" — from inside the browser dispatcher rather than from the story.
    // `project-wrapper.tsx` sets it in the app; nothing set it here, so every
    // event a module story dispatched was dropped on the floor.
    (
      frontendModules as { reducers: TReducersFrontendExports }
    ).reducers.dispatcher.setProjectId(STORY_PROJECT_ID);

    return { backendModules, frontendModules };
  }, []);

  return (
    <CollabProjectProvider project_id="story-project">
      <ModuleProvider exports={frontendModules}>
        <div style={{ height: '100vh', width: '100vw' }}>
          <Whiteboard viewId={STORY_VIEW_ID} projectId={'story-project'} />
        </div>
      </ModuleProvider>
    </CollabProjectProvider>
  );
};

//

const meta = {
  title: 'Modules/Whiteboard/Views/Main',
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

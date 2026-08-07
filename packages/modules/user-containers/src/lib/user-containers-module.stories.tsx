import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import { EPriority, Logger } from '@holistix-forge/log';
import { StoryApiContext } from '@holistix-forge/frontend-data';
import { StoryWhiteboard } from '@holistix-forge/whiteboard/stories';

//
import { loadModules, TModule } from '@holistix-forge/module';
import { ModuleProvider } from '@holistix-forge/module/frontend';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@holistix-forge/core-graph';
import {
  moduleBackend as collabBackend,
  createLocalCollabRegistry,
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
import { moduleBackend as spaceBackend } from '@holistix-forge/whiteboard';
import { moduleFrontend as spaceFrontend } from '@holistix-forge/whiteboard/frontend';
import { moduleBackend as tabsBackend } from '@holistix-forge/tabs';
import { moduleFrontend as tabsFrontend } from '@holistix-forge/tabs/frontend';
//
import {
  TUserContainersExports,
  moduleBackend as userContainersBackend,
} from '..';
import { moduleFrontend as userContainersFrontend } from '../frontend';

//

Logger.setPriority(EPriority.Debug);

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
      load: ({ moduleExports }) => {
        moduleExports({
          // user-containers registers its permissions against this at load.
          // The stub predates it, so the module read `.register` off undefined
          // and the whole story died before painting.
          permissionRegistry: {
            register: () => {
              // A story enforces nothing; it only has to let the module load.
            },
          },
          project_id: 'test',
          updateReverseProxy: async () => {
            console.log('updateReverseProxy');
          },
        });
      },
    },
    config: {},
  },
  { module: spaceBackend, config: {} },
  { module: tabsBackend, config: {} },
  { module: userContainersBackend, config: {} },
  {
    module: {
      name: 'story-init',
      version: '0.0.1',
      description: 'Story init module',
      dependencies: ['collab'],
      load: ({ depsExports }) => {
        (
          depsExports as unknown as {
            'user-containers': TUserContainersExports;
          }
        )['user-containers'].imageRegistry.register([
          {
            imageId: 'test',
            imageName: 'Test',
            description: 'Test',
            imageUri: '',
            imageTag: '',
          },
        ]);
        //
      },
    },
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
  // tabs comes first: loadModules walks this list in order and refuses a
  // module whose dependency has not been loaded yet, which it says by name.
  { module: tabsFrontend, config: {} },
  { module: userContainersFrontend, config: {} },
];

//

const Story = () => {
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
    <StoryApiContext>
      <CollabProjectProvider project_id="story-project">
        <ModuleProvider exports={frontendModules}>
          <div style={{ height: '100vh', width: '100vw' }}>
            <StoryWhiteboard />
          </div>
        </ModuleProvider>
      </CollabProjectProvider>
    </StoryApiContext>
  );
};

const meta = {
  title: 'Modules/UserContainers/Views/Main',
  component: Story,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {},
} satisfies Meta<typeof Story>;

export default meta;

export const Default: StoryObj<typeof Story> = {
  args: {},
};

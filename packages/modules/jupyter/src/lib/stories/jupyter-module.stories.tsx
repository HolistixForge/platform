import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import { EPriority, Logger } from '@holistix-forge/log';
import { StoryWhiteboard } from '@holistix-forge/whiteboard/stories';
import { StoryApiContext } from '@holistix-forge/frontend-data';

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
import { moduleBackend as userContainersBackend } from '@holistix-forge/user-containers';
import { moduleFrontend as userContainersFrontend } from '@holistix-forge/user-containers/frontend';
//
import { moduleBackend as jupyterBackend } from '../..';
import { moduleFrontend as jupyterFrontend } from '../../frontend';

import {
  JupyterStoryInit,
  createStoryInitModule,
} from './module-stories-utils';

//

Logger.setPriority(EPriority.Debug);

const collabConfig = {
  type: 'none' as const,
  room_id: 'jupyter-story',
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
          project_id: 'test',
          updateReverseProxy: async () => {
            console.log('updateReverseProxy');
          },
          permissionRegistry: {
            register: () => {
              // Mock implementation for storybook
            },
          },
        });
      },
    },
    config: {},
  },
  { module: spaceBackend, config: {} },
  { module: tabsBackend, config: {} },
  { module: userContainersBackend, config: {} },
  { module: jupyterBackend, config: {} },
  {
    module: createStoryInitModule(),
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
  { module: tabsFrontend, config: {} },
  { module: userContainersFrontend, config: {} },
  { module: jupyterFrontend, config: {} },
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

    return { backendModules, frontendModules };
  }, []);

  return (
    <StoryApiContext>
      <CollabProjectProvider project_id="story-project">
        <ModuleProvider exports={frontendModules}>
          <JupyterStoryInit>
            <div style={{ height: '100vh', width: '100vw' }}>
              <StoryWhiteboard />
            </div>
          </JupyterStoryInit>
        </ModuleProvider>
      </CollabProjectProvider>
    </StoryApiContext>
  );
};

const meta = {
  title: 'Modules/Jupyter/Views/Main',
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

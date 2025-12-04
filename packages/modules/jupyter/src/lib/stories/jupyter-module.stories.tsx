import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import { EPriority, Logger } from '@holistix/log';
import { StoryDemiurgeSpace } from '@holistix/space/stories';
import { StoryApiContext } from '@holistix/frontend-data';

//
import { loadModules, TModule } from '@holistix/module';
import { ModuleProvider } from '@holistix/module/frontend';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@holistix/core-graph';
import { moduleBackend as collabBackend } from '@holistix/collab';
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
import { moduleBackend as spaceBackend } from '@holistix/space';
import { moduleFrontend as spaceFrontend } from '@holistix/space/frontend';
import { moduleBackend as tabsBackend } from '@holistix/tabs';
import { moduleFrontend as tabsFrontend } from '@holistix/tabs';
//
import { moduleBackend as userContainersBackend } from '@holistix/user-containers';
import { moduleFrontend as userContainersFrontend } from '@holistix/user-containers/frontend';
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
  type: 'none',
  room_id: 'jupyter-story',
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
          protectedServiceRegistry: {
            registerService: () => {
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
    config: collabConfig,
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
      <ModuleProvider exports={frontendModules}>
        <JupyterStoryInit>
          <div style={{ height: '100vh', width: '100vw' }}>
            <StoryDemiurgeSpace />
          </div>
        </JupyterStoryInit>
      </ModuleProvider>
    </StoryApiContext>
  );
};

const meta = {
  title: 'Modules/Jupyter/Main',
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

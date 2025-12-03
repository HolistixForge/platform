import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import { EPriority, Logger } from '@holistix/log';
import { StoryApiContext } from '@holistix/frontend-data';
import { StoryDemiurgeSpace } from '@holistix/space/stories';

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
import {
  TUserContainersExports,
  moduleBackend as userContainersBackend,
} from '..';
import { moduleFrontend as userContainersFrontend } from '../frontend';

//

Logger.setPriority(EPriority.Debug);

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
      load: ({ moduleExports }) => {
        moduleExports({
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
    config: collabConfig,
  },
  { module: reducersFrontend, config: {} },
  { module: coreFrontend, config: {} },
  { module: spaceFrontend, config: {} },
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

    return { backendModules, frontendModules };
  }, []);

  return (
    <StoryApiContext>
      <ModuleProvider exports={frontendModules}>
        <div style={{ height: '100vh', width: '100vw' }}>
          <StoryDemiurgeSpace />
        </div>
      </ModuleProvider>
    </StoryApiContext>
  );
};

const meta = {
  title: 'Modules/UserContainers/Main',
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

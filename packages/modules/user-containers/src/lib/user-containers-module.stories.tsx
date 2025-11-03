import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import { Logger } from '@monorepo/log';
import { StoryApiContext } from '@monorepo/frontend-data';
import { StoryHolistixSpace } from '@monorepo/space/stories';

//
import { loadModules, TModule } from '@monorepo/module';
import { ModuleProvider } from '@monorepo/module/frontend';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@monorepo/core-graph';
import { moduleBackend as collabBackend } from '@monorepo/collab';
import { moduleFrontend as collabFrontend } from '@monorepo/collab/frontend';
import {
  moduleBackend as reducersBackend,
  TReducersBackendExports,
} from '@monorepo/reducers';
import {
  moduleFrontend as reducersFrontend,
  linkDispatchToProcessEvent,
  TReducersFrontendExports,
} from '@monorepo/reducers/frontend';
import { moduleBackend as spaceBackend } from '@monorepo/space';
import { moduleFrontend as spaceFrontend } from '@monorepo/space/frontend';
import { moduleBackend as tabsBackend } from '@monorepo/tabs';
import { moduleFrontend as tabsFrontend } from '@monorepo/tabs';
//
import {
  TUserContainersExports,
  moduleBackend as userContainersBackend,
} from '..';
import { moduleFrontend as userContainersFrontend } from '../frontend';

//

Logger.setPriority(7);

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
          <StoryHolistixSpace />
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

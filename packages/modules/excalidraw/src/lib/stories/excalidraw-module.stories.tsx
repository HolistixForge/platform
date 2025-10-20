import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import { Logger } from '@monorepo/log';
import { StoryApiContext } from '@monorepo/frontend-data';

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
//
import { moduleBackend as excalidrawBackend } from '../..';
import { moduleFrontend as excalidrawFrontend } from '../../frontend';

import { StoryHolistixSpace } from '@monorepo/space/stories';

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
      load: () => {
        //
      },
    },
    config: {},
  },
  { module: spaceBackend, config: {} },
  { module: excalidrawBackend, config: {} },
];

const modulesFrontend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabFrontend,
    config: collabConfig,
  },
  { module: reducersFrontend, config: {} },
  { module: coreFrontend, config: {} },
  { module: spaceFrontend, config: {} },
  { module: excalidrawFrontend, config: {} },
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
  title: 'Modules/Excalidraw/Main',
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

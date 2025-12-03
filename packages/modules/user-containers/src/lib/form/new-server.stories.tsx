import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ModuleProvider } from '@holistix/module/frontend';
import { TModule, loadModules } from '@holistix/module';
import {
  moduleFrontend as collabFrontend,
  TCollabFrontendExports,
} from '@holistix/collab/frontend';
import { moduleFrontend as coreFrontend } from '@holistix/core-graph';
import { moduleFrontend as spaceFrontend } from '@holistix/space/frontend';
import { moduleFrontend as tabsFrontend } from '@holistix/tabs';
import { moduleFrontend as reducersFrontend } from '@holistix/reducers/frontend';

import { NewContainerForm } from './new-server';
import { TUserContainersSharedData } from '../servers-shared-model';
import { moduleFrontend as userContainersFrontend } from '../../frontend';

//
const collabConfig = {
  type: 'none',
  room_id: 'space-story',
  simulateUsers: true,
  user: { username: 'test', color: 'red' },
};

const modulesFrontend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabFrontend,
    config: collabConfig,
  },
  { module: reducersFrontend, config: {} },
  { module: coreFrontend, config: {} },
  { module: spaceFrontend, config: {} },
  { module: tabsFrontend, config: {} },
  {
    module: userContainersFrontend,
    config: {},
  },
  {
    module: {
      name: 'story-init',
      version: '0.0.1',
      description: 'Story init module',
      dependencies: ['collab'],
      load: ({ depsExports }) => {
        (
          depsExports as unknown as {
            collab: TCollabFrontendExports<TUserContainersSharedData>;
          }
        ).collab.collab.sharedData['user-containers:images'].set('test', {
          imageId: 'test',
          imageName: 'Test',
          description: 'Test',
        });
        //
      },
    },
    config: {},
  },
];

const StoryWrapper = () => {
  const frontendModules = useMemo(() => {
    const frontendModules = loadModules(modulesFrontend);
    return frontendModules;
  }, []);

  return (
    <ModuleProvider exports={frontendModules}>
      <NewContainerForm
        projectId={''}
        viewId={''}
        position={{ x: 0, y: 0 }}
        closeForm={() => null}
      />
    </ModuleProvider>
  );
};

//

const meta = {
  title: 'Modules/UserContainers/Forms/NewServer',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Normal: Story = {
  args: {},
};

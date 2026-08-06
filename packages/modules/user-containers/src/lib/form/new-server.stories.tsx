import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ModuleProvider } from '@holistix-forge/module/frontend';
import { TModule, loadModules } from '@holistix-forge/module';
import {
  moduleFrontend as collabFrontend,
  TCollabFrontendExports,
  CollabProjectProvider,
} from '@holistix-forge/collab/frontend';
import { moduleFrontend as coreFrontend } from '@holistix-forge/core-graph';
import { moduleFrontend as spaceFrontend } from '@holistix-forge/whiteboard/frontend';
import { moduleFrontend as reducersFrontend } from '@holistix-forge/reducers/frontend';
import { moduleFrontend as tabsFrontend } from '@holistix-forge/tabs/frontend';

import { NewContainerForm } from './new-server';
import { moduleFrontend as userContainersFrontend } from '../../frontend';

// One project id, named once. The seeding module wrote to `'story'` while the
// provider announced `'story-project'`: harmless only because the local
// registry hands back the same document for every id, and a silent
// "the form has no images" the moment it does not.
const STORY_PROJECT_ID = 'story-project';

//
// `as const` on the type, and a `user_id` on the awareness user — the same
// shape every other module story in this repository uses. Widened to `string`
// the config still selected `NoneCollab` at runtime, so this worked; it was
// simply the one file that would drift, and awareness code reading
// `user.user_id` found nothing here.
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

const modulesFrontend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabFrontend,
    config: collabFrontendConfig,
  },
  { module: reducersFrontend, config: {} },
  { module: coreFrontend, config: {} },
  { module: spaceFrontend, config: {} },
  // user-containers declares tabs as a dependency; loadModules refuses to
  // load it without one, and said so plainly.
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
        const collabExports = (
          depsExports as unknown as {
            collab: TCollabFrontendExports;
          }
        ).collab;

        const images = collabExports.getCollabForProject(STORY_PROJECT_ID)
          .collab.sharedData['user-containers:images'] as any;
        images.set('test', {
          imageId: 'test',
          imageName: 'Test',
          description: 'Test',
        });
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
    <CollabProjectProvider project_id={STORY_PROJECT_ID}>
      <ModuleProvider exports={frontendModules}>
        <NewContainerForm
          projectId={''}
          viewId={''}
          position={{ x: 0, y: 0 }}
          closeForm={() => null}
        />
      </ModuleProvider>
    </CollabProjectProvider>
  );
};

//

const meta = {
  title: 'Modules/UserContainers/Components/Forms/NewServer',
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

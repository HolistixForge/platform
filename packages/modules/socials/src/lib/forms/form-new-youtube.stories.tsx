import { CollabProjectProvider } from '@holistix-forge/collab/frontend';
import type { Meta, StoryObj } from '@storybook/react';

import { ModuleProvider } from '@holistix-forge/module/frontend';

import { NewYoutubeForm } from './form-new-youtube';

//

const fakeFrontendModules = {
  reducers: {
    dispatcher: {
      dispatch: () => {
        /**/
      },
    },
  },
};

const StoryWrapper = () => {
  return (
    <CollabProjectProvider project_id="story-project">
      <ModuleProvider exports={fakeFrontendModules}>
        <NewYoutubeForm
          viewId={''}
          position={{ x: 0, y: 0 }}
          closeForm={() => {
            /**/
          }}
        />
      </ModuleProvider>
    </CollabProjectProvider>
  );
};

//

const meta = {
  title: 'Modules/Socials/Components/Forms/NewYoutube',
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

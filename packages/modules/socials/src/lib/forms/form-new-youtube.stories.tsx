import type { Meta, StoryObj } from '@storybook/react';

import { ModuleProvider } from '@monorepo/module/frontend';

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
    <ModuleProvider exports={fakeFrontendModules}>
      <NewYoutubeForm
        viewId={''}
        position={{ x: 0, y: 0 }}
        closeForm={() => {
          /**/
        }}
      />
    </ModuleProvider>
  );
};

//

const meta = {
  title: 'Modules/Socials/Forms/NewYoutube',
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

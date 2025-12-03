import type { Meta, StoryObj } from '@storybook/react';
import { ModuleProvider } from '@holistix/module/frontend';

import { NewIframeForm } from './form-new-iframe';

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
      <NewIframeForm
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
  title: 'Modules/Socials/Forms/NewIframe',
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

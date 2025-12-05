import type { Meta, StoryObj } from '@storybook/react';

import { JupyterStoryCollabContext } from '../stories/module-stories-utils';

import { NewKernelForm } from './new-kernel';

//

const StoryWrapper = () => {
  return (
    <JupyterStoryCollabContext>
      <NewKernelForm
        user_container_id={1}
        position={{ x: 0, y: 0 }}
        viewId={''}
        closeForm={() => null}
      />
    </JupyterStoryCollabContext>
  );
};

//

const meta = {
  title: 'Modules/Jupyter/Forms/NewKernel',
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

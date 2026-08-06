import type { Meta, StoryObj } from '@storybook/react';

import { JupyterStoryProviders } from '../stories/module-stories-utils';

import { NewTerminalForm } from './new-terminal';

//

const StoryWrapper = () => {
  return (
    <JupyterStoryProviders>
      <NewTerminalForm
        user_container_id={'1'}
        position={{ x: 0, y: 0 }}
        viewId={''}
        closeForm={() => null}
      />
    </JupyterStoryProviders>
  );
};

//

const meta = {
  title: 'Modules/Jupyter/Components/Forms/NewTerminal',
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

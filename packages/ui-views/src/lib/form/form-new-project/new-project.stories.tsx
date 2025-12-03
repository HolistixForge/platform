import type { Meta, StoryObj } from '@storybook/react';

import { useAction, DialogControlled } from '@holistix/ui-base';
import { NewProjectFormData } from '@holistix/frontend-data';

import { NewProjectForm } from './new-project';

//

const StoryWrapper = () => {
  const action = useAction<NewProjectFormData>((d) => {
    console.log(d);
    return Promise.resolve();
  }, []);
  return (
    <DialogControlled
      title="New Project"
      description="Choose a project name"
      open={true}
      onOpenChange={() => null}
    >
      <NewProjectForm action={action} />
    </DialogControlled>
  );
};

//

const meta = {
  title: 'Forms/NewProject',
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

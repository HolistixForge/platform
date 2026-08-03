import type { Meta, StoryObj } from '@storybook/react';

import { useAction, DialogControlled } from '@holistix-forge/ui-base';
import { NewOrganizationFormData } from '@holistix-forge/frontend-data';

import { NewOrganizationForm } from './new-organization';

//

const StoryWrapper = ({ failing }: { failing?: boolean }) => {
  const action = useAction<NewOrganizationFormData>(
    () =>
      failing
        ? Promise.reject(new Error('An organization with that name exists'))
        : Promise.resolve(),
    [failing]
  );
  return (
    <DialogControlled
      title="New Organization"
      description="Choose an organization name"
      open={true}
      onOpenChange={() => null}
    >
      <NewOrganizationForm action={action} />
    </DialogControlled>
  );
};

//

const meta = {
  title: 'Forms/NewOrganization',
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

/** Submitting surfaces the backend error through `FormErrors`. */
export const Failing: Story = {
  args: { failing: true },
};

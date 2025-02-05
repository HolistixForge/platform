import type { Meta, StoryObj } from '@storybook/react';

import { useAction, DialogControlled } from '@monorepo/demiurge-ui-components';

import { NewServerForm, NewServerFormData } from './new-server';

//

const images = [
  {
    image_id: 0,
    image_name: 'image super bien',
    image_sha256: null,
    image_tag: 'ffa500',
  },
  {
    image_id: 1,
    image_name: 'mega lib 42',
    image_sha256: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    image_tag: 'ffa500',
  },
];

const StoryWrapper = () => {
  const action = useAction<NewServerFormData>((d) => {
    console.log(d);
    return Promise.resolve();
  }, []);
  return (
    <DialogControlled
      title="New server"
      description="Choose a name and select an image for your new server."
      open={true}
      onOpenChange={() => null}
    >
      <NewServerForm images={images} action={action} />
    </DialogControlled>
  );
};

//

const meta = {
  title: 'Forms/NewServer',
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

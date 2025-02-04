import type { Meta, StoryObj } from '@storybook/react';

import { useAction, DialogControlled } from '@monorepo/demiurge-ui-components';

import { DockerOptionsForm, DockerOptionsFormData } from './docker-options';

//

const StoryWrapper = () => {
  const action = useAction<DockerOptionsFormData>(
    async (d) => {
      console.log(d);
      const e = new Error('');
      (e as any).json = {
        errors: {
          memory: "pourquoi pas plus tant qu'on y est",
          storage: "il n'y en a plus",
          cpu: "c'est trop",
          gpuAccess: 'no nvidia cuda layer in tour docker engine',
          global: 'non faut pas déconner quand meme',
        },
      };
      throw e;
      return;
    },
    [],
    {
      values: {
        cpu: 4,
        memory: 1024,
        storage: 10,
        gpuAccess: 'specific',
        gpuIds: '',
      },
    }
  );
  return (
    <DialogControlled
      title="Docker Options"
      description="select docker resources limits"
      open={true}
      onOpenChange={() => null}
    >
      <DockerOptionsForm action={action} />
    </DialogControlled>
  );
};

//

const meta = {
  title: 'Forms/DockerOptions',
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

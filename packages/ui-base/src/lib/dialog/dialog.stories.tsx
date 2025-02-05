import type { Meta, StoryObj } from '@storybook/react';
import { DialogControlled } from './dialog';

const meta: Meta<typeof DialogControlled> = {
  component: DialogControlled,
  title: 'Forms/DialogModal',
};
export default meta;
type Story = StoryObj<typeof DialogControlled>;

export const Primary: Story = {
  args: {
    title: 'Dialog Title',
    description: 'Lorem ipsum solor sit amet',
    open: true,
    children: <span>coucou</span>,
  },
  play: async ({ canvasElement }) => {
    // const canvas = within(canvasElement);
    // expect(canvas.getByText(/Welcome to DialogControlled!/gi)).toBeTruthy();
  },
};

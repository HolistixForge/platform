import type { Meta, StoryObj } from '@storybook/react';

import { ServerStack } from './server-stack';

//

/** Stand-in for a resource card: the stack only lays its children out. */
const Card = ({ name }: { name: string }) => (
  <div
    style={{
      width: '400px',
      height: '202px',
      borderRadius: '8px',
      background: 'var(--color-bg-elevated, rgba(255,255,255,0.06))',
      border: '1px solid rgba(255,255,255,0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '14px',
    }}
  >
    {name}
  </div>
);

const StoryWrapper = ({ count }: { count: number }) => (
  <div style={{ width: '1000px' }}>
    <ServerStack onNewServerClick={() => undefined}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={`server-${i}`} name={`server-${i}`} />
      ))}
    </ServerStack>
  </div>
);

//

const meta = {
  title: 'Mvp/Components/ServerStack',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

/** Only the "add resource" placeholder. */
export const Empty: Story = {
  args: { count: 0 },
};

export const Normal: Story = {
  args: { count: 3 },
};

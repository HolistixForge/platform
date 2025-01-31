import type { Meta, StoryObj } from '@storybook/react';

import { Slot, SlotProps } from './Slot';
import { ReactFlowProvider } from 'reactflow';

import '../inputsOutputs/inputsOutputs.css';

const SlotStory = (props: SlotProps) => {
  return (
    <ReactFlowProvider>
      <div
        style={{
          width: '100px',
          height: '100px',
          margin: '100px',
          background: 'var(--ca-white-1)',
          borderRadius: '10px',
          position: 'relative',
          textAlign: 'center',
          color: 'var(--c-gray-8)',
          padding: '15px 0',
          boxSizing: 'border-box',
        }}
      >
        <span>position relative</span>
        <div
          className={
            props.type === 'source'
              ? `node-outputs-opened`
              : `node-inputs-opened`
          }
        >
          <div className={`handles-bar`} style={{ position: 'relative' }}>
            <ul>
              <Slot {...props} />
            </ul>
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
};

const meta = {
  title: 'Space/ReactFlow/Slot',
  component: SlotStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    type: {
      options: ['source', 'target'],
      mapping: ['source', 'target'],
      control: {
        type: 'select',
        labels: ['source', 'target'],
      },
    },
  },
} satisfies Meta<typeof Slot>;

export default meta;

type Story = StoryObj<typeof Slot>;

export const Normal: Story = {
  args: {
    id: 'node_5_source_4',
    name: 'Slot name',
    type: 'source',
    isConnectable: true,
  },
};

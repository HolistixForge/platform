import type { Meta, StoryObj } from '@storybook/react';
import ReactFlow, {
  Background,
  Edge,
  EdgeProps,
  Handle,
  Node,
  NodeProps,
  Position,
} from 'reactflow';

import 'reactflow/dist/style.css';
import { EdgeComponent, LabelEnd, LabelMiddle, LabelStart } from './edge';
import { sleep } from '../../../../storybook-utils';

//
type NData = { id: string };

const nodes: Node<NData>[] = [];

const edges: Edge[] = [];

//
//
//

const GAP = 120;

const edgeStyles: string[][] = [
  ['edge-reference'],
  ['edge-reference', 'chat-anchor'],
  ['edge-reference', 'mount'],
  ['edge-reference', 'mount', 'source-highlighted', 'testhover'],
  ['edge-reference', 'terminal'],
  ['edge-reference', 'terminal', 'source-highlighted', 'testhover'],
  ['edge-sequence'],
  ['edge-sequence', 'target-highlighted', 'testhover'],
  ['edges-group'],
  ['edges-group', 'testhover'],
];

for (let index = 0; index < edgeStyles.length; index++) {
  const className = edgeStyles[index].join(' ');
  const sid = `node-source-${index}`;
  const tid = `node-target-${index}`;

  nodes.push({
    id: sid,
    position: { x: index * GAP + 50, y: 50 },
    data: { id: sid },
    type: 'custom',
  });

  nodes.push({
    id: tid,
    position: { x: index * GAP + GAP, y: 350 },
    data: { id: tid },
    type: 'custom',
  });

  edges.push({
    id: `${sid}:${tid}`,
    source: sid,
    target: tid,
    type: 'custom',
    data: { className },
    className,
  });
}

//
//
//

const CustomNode = ({ id }: NodeProps<NData>) => {
  return (
    <div
      style={{
        width: '50px',
        height: '50px',
        borderRadius: '10px',
        background: 'var(--c-black-3)',
      }}
    >
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

const CustomEdge = (props: EdgeProps<{ className: string }>) => {
  const straight = props.data?.className.includes('chat-anchor');
  return (
    <EdgeComponent {...props} type={straight ? 'straight' : 'default'}>
      <LabelMiddle>{props.data?.className}</LabelMiddle>
      <LabelStart>Label Start</LabelStart>
      <LabelEnd>Label End</LabelEnd>
    </EdgeComponent>
  );
};

const edgeTypes = {
  custom: CustomEdge,
};

const StoryWrapper = () => {
  return (
    <div style={{ width: 'calc(100vw - 50px)', height: 'calc(100vh - 50px)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
      >
        <Background />
      </ReactFlow>
    </div>
  );
};

//

const meta = {
  title: 'Space/ReactFlow/Edges',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
    color: {
      control: {
        type: 'color',
      },
    },
  },
  argTypes: {
    data: { control: 'object' },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Primary: Story = {
  args: {},
};

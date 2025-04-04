import type { Meta, StoryObj } from '@storybook/react';
import {
  ReactFlow,
  Background,
  Edge,
  EdgeProps,
  Handle,
  Node,
  NodeProps,
  Position,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import { EdgeComponent, LabelEnd, LabelMiddle, LabelStart } from './edge';
import { EdgeShape } from '../../../apis/types/edge';

//
type NData = { id: string };

//
//
//

const GAP = 120;

const edgeSemanticTypes: string[][] = [
  ['_unknown_'],
  ['_unknown_', 'edges-group'],
  ['_unknown_', 'testhover'],
  ['_unknown_', 'edges-group', 'testhover'],
  ['referenced_by'],
  ['next_in_sequence'],
  ['owned_by'],
  ['composed_of'],
  ['satisfied_by'],
  ['tested_by'],
  ['wired_to'],
  ['depends_on'],
  ['easy-connect'],
];

const makeNodesAndEdges = (edgeShape: EdgeShape) => {
  const nodes: Node<NData>[] = [];

  const edges: Edge[] = [];

  for (let index = 0; index < edgeSemanticTypes.length; index++) {
    const className = edgeSemanticTypes[index].join(' ');
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
      data: { className, edge: { data: { edgeShape } } },
      className,
    });
  }
  return { nodes, edges };
};

//
//
//

const CustomNode = ({ id }: NodeProps) => {
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

const CustomEdge = (props: EdgeProps) => {
  return (
    <EdgeComponent {...props}>
      <LabelMiddle>{props.data!.className as string}</LabelMiddle>
      <LabelStart>Label Start</LabelStart>
      <LabelEnd>Label End</LabelEnd>
    </EdgeComponent>
  );
};

const edgeTypes = {
  custom: CustomEdge,
};

const StoryWrapper = ({ edgeShape }: { edgeShape: EdgeShape }) => {
  const { nodes, edges } = makeNodesAndEdges(edgeShape);

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
  title: 'Modules/Space/Components/Edges',
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
    edgeShape: {
      control: 'select',
      options: ['bezier', 'square', 'straight'],
    },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Primary: Story = {
  args: {},
};

import { TEdge } from '@holistix-forge/core-graph';
import { TGraphNode, TPin } from '@holistix-forge/core-graph';

import { nodeViewDefaultStatus, TNodeView } from '../../space-types';
import { pinId, TEdgeRenderProps } from '../../components/apis/types/edge';
import { MarkerType } from '@xyflow/react';

//

const makePins = (connectorName: string, count: number): TPin[] => {
  return Array.from({ length: count }, (_, index) => ({
    id: pinId({ connectorName, pinName: `slot-${index}` }),
    pinName: `slot ${index}`,
  }));
};

//

export const graph1: {
  nodeViews: TNodeView[];
  edges: (TEdge & { renderProps?: TEdgeRenderProps })[];
  nodes: TGraphNode[];
} = {
  nodeViews: [
    {
      id: 'node-1',
      type: 'default',
      position: {
        x: 0,
        y: 0,
      },
      status: nodeViewDefaultStatus(),
    },
    {
      id: 'node-2',
      type: 'default',
      position: {
        x: 400,
        y: 700,
      },
      status: nodeViewDefaultStatus(),
    },
    {
      id: 'node-3',
      type: 'default',
      position: {
        x: 600,
        y: 300,
      },
      status: nodeViewDefaultStatus(),
    },
    {
      id: 'node-4',
      type: 'default',
      position: {
        x: 800,
        y: 600,
      },
      status: nodeViewDefaultStatus(),
    },
    {
      id: 'node-5',
      type: 'group',
      position: {
        x: 1000,
        y: 800,
      },
      status: nodeViewDefaultStatus(),
    },
  ],
  //
  edges: [
    {
      from: {
        node: 'node-1',
        connectorName: 'outputs',
        pinName: 'slot-2',
      },
      to: {
        node: 'node-2',
        connectorName: 'inputs',
        pinName: 'slot-1',
      },
      semanticType: 'satisfied_by',
      renderProps: {
        edgeShape: 'square',
        style: {
          stroke: 'red',
          strokeWidth: '5',
          strokeDasharray: '10 5',
        },
      },
    },
    {
      from: {
        node: 'node-1',
        connectorName: 'outputs',
        pinName: 'slot-0',
      },
      to: {
        node: 'node-2',
        connectorName: 'inputs',
        pinName: 'slot-2',
      },
      semanticType: 'composed_of',
      renderProps: {
        edgeShape: 'straight',
        style: {
          strokeDasharray: '5 5',
        },
        markerStart: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: '#FFA500',
          orient: 'auto-start-reverse',
        },
      },
    },
    {
      from: {
        node: 'node-3',
        connectorName: 'outputs',
        pinName: 'slot-1',
      },
      to: {
        node: 'node-2',
        connectorName: 'inputs',
        pinName: 'slot-2',
      },
      semanticType: 'depends_on',
      renderProps: {},
    },
    {
      from: {
        node: 'node-2',
        connectorName: 'outputs',
        pinName: 'slot-1',
      },
      to: {
        node: 'node-4',
        connectorName: 'inputs',
      },
      semanticType: 'referenced_by',
      renderProps: {
        markerEnd: {
          type: MarkerType.Arrow,
          width: 25,
          height: 25,
          color: '#52acff',
        },
        markerStart: {
          type: MarkerType.Arrow,
          width: 25,
          height: 25,
          color: '#52acff',
          orient: 'auto-start-reverse',
        },
      },
    },
  ],
  //
  nodes: [
    {
      id: 'node-1',
      name: 'node-1',
      type: 'default',
      root: true,
      connectors: [
        {
          connectorName: 'outputs',
          pins: makePins('outputs', 3),
        },
        {
          connectorName: 'inputs',
          pins: makePins('inputs', 3),
        },
      ],
    },
    {
      id: 'node-2',
      name: 'node-2',
      type: 'default',
      root: false,
      connectors: [
        {
          connectorName: 'outputs',
          pins: makePins('outputs', 3),
        },
        {
          connectorName: 'inputs',
          pins: makePins('inputs', 3),
        },
      ],
    },

    {
      id: 'node-3',
      name: 'node-3',
      type: 'default',
      root: false,
      connectors: [
        {
          connectorName: 'outputs',
          pins: makePins('outputs', 3),
        },
        {
          connectorName: 'inputs',
          pins: makePins('inputs', 3),
        },
      ],
    },

    {
      id: 'node-4',
      name: 'node-4',
      type: 'default',
      root: false,
      data: { example: 'hello' },
      connectors: [
        {
          connectorName: 'outputs',
          pins: [],
        },
        {
          connectorName: 'inputs',
          pins: [],
        },
      ],
    },

    {
      id: 'node-5',
      name: 'node-5',
      type: 'group',
      root: true,
      connectors: [
        {
          connectorName: 'outputs',
          pins: [],
        },
        {
          connectorName: 'inputs',
          pins: [],
        },
      ],
      data: {
        title: 'Group 1',
      },
    },
  ],
};

//

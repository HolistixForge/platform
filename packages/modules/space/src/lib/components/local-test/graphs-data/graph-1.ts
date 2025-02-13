import { TEdge, TGraphNode, TPin } from '@monorepo/core';

import { nodeViewDefaultStatus, TNodeView } from '../../../space-types';
import { pinId } from '../../apis/types/edge';

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
  edges: TEdge[];
  nodes: TGraphNode[];
} = {
  nodeViews: [
    {
      id: 'node-1',
      position: {
        x: 200,
        y: 200,
      },
      status: nodeViewDefaultStatus(),
    },
    {
      id: 'node-2',
      position: {
        x: 400,
        y: 700,
      },
      status: nodeViewDefaultStatus(),
    },
    {
      id: 'node-3',
      position: {
        x: 600,
        y: 300,
      },
      status: nodeViewDefaultStatus(),
    },
    {
      id: 'node-4',
      position: {
        x: 800,
        y: 600,
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
      type: 'satisfied_by',
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
      type: 'composed_of',
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
      type: 'depends_on',
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
      type: 'referenced_by',
    },
  ],
  //
  nodes: [
    {
      id: 'node-1',
      name: 'node-1',
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
  ],
};

//

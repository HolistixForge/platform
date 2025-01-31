import { nodeViewDefaultStatus } from '../../apis/types/node';
import { TConnector, TSpaceState } from '../../apis/spaceState';
import { pinId } from '../../apis/types/edge';

const makeSlots = (connectorName: string, count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: pinId({ connectorName, pinName: `slot-${index}` }),
    name: `slot ${index}`,
  }));
};

//

export const graph1: TSpaceState = {
  nodes: [
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
  connectors: new Map<string, TConnector[]>([
    [
      'node-1',
      [
        {
          connectorName: 'outputs',
          isOpened: true,
          groupedEdgesCount: 0,
          slots: makeSlots('outputs', 3),
          type: 'source',
        },
        {
          connectorName: 'inputs',
          isOpened: false,
          groupedEdgesCount: 0,
          slots: makeSlots('inputs', 3),
          type: 'target',
        },
      ],
    ],
    [
      'node-2',
      [
        {
          connectorName: 'outputs',
          isOpened: false,
          groupedEdgesCount: 0,
          slots: makeSlots('outputs', 3),
          type: 'source',
        },
        {
          connectorName: 'inputs',
          isOpened: true,
          groupedEdgesCount: 0,
          slots: makeSlots('inputs', 3),
          type: 'target',
        },
      ],
    ],
    [
      'node-3',
      [
        {
          connectorName: 'outputs',
          isOpened: false,
          groupedEdgesCount: 0,
          slots: makeSlots('outputs', 3),
          type: 'source',
        },
        {
          connectorName: 'inputs',
          isOpened: true,
          groupedEdgesCount: 0,
          slots: makeSlots('inputs', 3),
          type: 'target',
        },
      ],
    ],
    [
      'node-4',
      [
        {
          connectorName: 'outputs',
          isOpened: false,
          groupedEdgesCount: 0,
          slots: undefined,
          type: 'source',
        },
        {
          connectorName: 'inputs',
          isOpened: true,
          groupedEdgesCount: 0,
          slots: undefined,
          type: 'target',
        },
      ],
    ],
  ]),
};

//

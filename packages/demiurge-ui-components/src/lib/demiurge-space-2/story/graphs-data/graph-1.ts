import { nodeViewDefaultStatus } from '@monorepo/demiurge-types';
import { TConnector, TSpaceState } from '../../apis/spaceState';

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
        y: 500,
      },
      status: nodeViewDefaultStatus(),
    },
  ],
  //
  edges: [
    {
      from: {
        node: 'node-1',
        connector: 'handle_outputs_1',
      },
      to: {
        node: 'node-2',
        connector: 'handle_inputs_0',
      },
      type: 'satisfied_by',
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
          slots: [
            { id: 'handle_outputs_0', name: 'slot 0' },
            { id: 'handle_outputs_1', name: 'slot 1' },
          ],
          type: 'source',
        },
        {
          connectorName: 'inputs',
          isOpened: false,
          groupedEdgesCount: 0,
          slots: [
            { id: 'handle_inputs_0', name: 'slot 0' },
            { id: 'handle_inputs_1', name: 'slot 1' },
          ],
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
          slots: [
            { id: 'handle_outputs_0', name: 'slot 0' },
            { id: 'handle_outputs_1', name: 'slot 1' },
          ],
          type: 'source',
        },
        {
          connectorName: 'inputs',
          isOpened: true,
          groupedEdgesCount: 0,
          slots: [
            { id: 'handle_inputs_0', name: 'slot 0' },
            { id: 'handle_inputs_1', name: 'slot 1' },
          ],
          type: 'target',
        },
      ],
    ],
  ]),
};

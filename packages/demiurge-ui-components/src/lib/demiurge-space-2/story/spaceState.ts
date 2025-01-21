import {
  TEdge,
  TNodeView,
  nodeViewDefaultStatus,
} from '@monorepo/demiurge-types';
import { SpaceState, TConnector } from '../apis/spaceState';

export class LocalSpaceState extends SpaceState {
  addListener(l: () => void): void {
    console.log('addListener called');
  }

  getNodes(): TNodeView[] {
    console.log('getNodes called');
    return [
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
    ];
  }

  getEdges(): TEdge[] {
    console.log('getEdges called');
    return [
      {
        from: {
          node: 'node-1',
          connector: 'outputs',
        },
        to: {
          node: 'node-2',
          connector: 'inputs',
        },
        type: 'satisfied_by',
      },
    ];
  }

  getConnector(nodeId: string, connectorName: string): TConnector {
    return {
      isOpened: false,
      groupedEdgesCount: 0,
      slots: Array(10)
        .fill(1)
        .map((v, k) => ({
          id: `handle_${connectorName}_${k}`,
          name: `slot ${k}`,
        })),
      type:
        connectorName === 'inputs'
          ? 'target'
          : connectorName === 'outputs'
          ? 'source'
          : 'target',
    };
  }
}

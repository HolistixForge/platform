import {
  nodeViewDefaultStatus,
  TEdge,
  TNodeView,
} from '@monorepo/demiurge-types';
import { THandle } from './assets/inputsOutputs/inputsOutputs';

type TConnector = {
  isOpened: boolean;
  groupedEdgesCount: number;
  slots: THandle[];
  type: 'source' | 'target';
};

export abstract class SpaceState {
  abstract addListener(l: () => void): void;
  abstract getNodes(): TNodeView[];
  abstract getEdges(): TEdge[];
  abstract getConnector(nodeId: string, connectorName: string): TConnector;
}

export class DummySpaceState extends SpaceState {
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

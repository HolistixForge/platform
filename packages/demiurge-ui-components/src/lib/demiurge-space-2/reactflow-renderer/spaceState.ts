import { THandle } from './assets/inputsOutputs/inputsOutputs';

type TConnector = {
  isOpened: boolean;
  groupedEdgesCount: number;
  slots: THandle[];
  type: 'source' | 'target';
};

export abstract class SpaceState {
  abstract addListener(l: () => void): void;
  abstract getNodes(): any;
  abstract getEdges(): any;
  abstract getConnector(nodeId: string, connectorName: string): TConnector;
}

export class DummySpaceState extends SpaceState {
  addListener(l: () => void): void {
    console.log('addListener called');
  }

  getNodes(): any {
    console.log('getNodes called');
    return [];
  }

  getEdges(): any {
    console.log('getEdges called');
    return [];
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

import { THandle } from './assets/inputsOutputs/inputsOutputs';

type TConnector = {
  isOpened: boolean;
  groupedEdgesCount: number;
  slots: THandle[];
  type: 'source' | 'target'
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
    throw new Error('Method not implemented.');
  }
}

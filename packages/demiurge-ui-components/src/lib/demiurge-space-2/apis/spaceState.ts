import { TEdge, TNodeView } from '@monorepo/demiurge-types';

/** one pin */
export type THandle = {
  name: string;
  id: string;
  isConnectable?: boolean;
};

//

export type TConnector = {
  isOpened: boolean;
  groupedEdgesCount: number;
  slots: THandle[];
  type: 'source' | 'target';
};

//

export abstract class SpaceState {
  abstract addListener(l: () => void): void;
  abstract getNodes(): TNodeView[];
  abstract getEdges(): TEdge[];
  abstract getConnector(nodeId: string, connectorName: string): TConnector;
}

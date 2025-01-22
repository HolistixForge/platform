import { Listenable } from './listenable';
import { TEdge } from './types/edge';
import { TNodeView } from './types/node';

/** one pin */
export type TPin = {
  name: string;
  id: string;
  isConnectable?: boolean;
};

//

export type TConnector = {
  connectorName: string;
  isOpened: boolean;
  groupedEdgesCount: number;
  slots: TPin[];
  type: 'source' | 'target';
};

//

export type TSpaceState = {
  nodes: TNodeView[];
  edges: TEdge[];
  connectors: Map<string, TConnector[]>;
};

export class SpaceState extends Listenable {
  protected _state: TSpaceState = {
    nodes: [],
    edges: [],
    connectors: new Map(),
  };

  public getNodes(): TNodeView[] {
    return this._state.nodes;
  }

  public getEdges(): TEdge[] {
    return this._state.edges;
  }

  public getConnector(
    nodeId: string,
    connectorName: string
  ): TConnector | undefined {
    const cs = this._state.connectors.get(nodeId);
    if (cs) return cs.find((c) => c.connectorName === connectorName);
    return undefined;
  }

  public setState(s: TSpaceState) {
    this._state = s;
    this.notifyListeners();
  }
}

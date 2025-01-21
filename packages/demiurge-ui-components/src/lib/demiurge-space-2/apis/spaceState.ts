import { TEdge, TNodeView } from '@monorepo/demiurge-types';
import { Listenable } from './listenable';
// TODO_DEMIURGE_SPACE: relocate from demiurge-types

/** one pin */
export type THandle = {
  name: string;
  id: string;
  isConnectable?: boolean;
};

//

export type TConnector = {
  connectorName: string;
  isOpened: boolean;
  groupedEdgesCount: number;
  slots: THandle[];
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

  public getStateCopy() {
    return structuredClone(this._state);
  }

  public setState(s: TSpaceState) {
    this._state = s;
    this.notifyListeners();
  }
}

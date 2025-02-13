import { TEdge, TConnector, TGraphNode } from '@monorepo/core';

import { Listenable } from './listenable';
import {
  TNodeView,
  TConnectorView,
  TGraphView,
  defaultGraphView,
  connectorViewDefault,
} from '../../space-types';

//

export class SpaceState extends Listenable {
  protected state: TGraphView = defaultGraphView();
  protected nodes: Map<string, TGraphNode> = new Map();

  public getNodes(): TNodeView[] {
    return this.state.graph.nodes;
  }

  public getEdges(): TEdge[] {
    return this.state.graph.edges;
  }

  public getConnector(
    nodeId: string,
    connectorName: string
  ): (TConnector & TConnectorView) | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;

    const connector = node.connectors.find(
      (c) => c.connectorName === connectorName
    );
    if (!connector) return undefined;

    let cv = this.state.connectorViews
      .get(nodeId)
      ?.find((cv) => cv.connectorName === connectorName);

    if (!cv) cv = connectorViewDefault(connectorName);

    return { ...connector, ...cv };
  }

  public setState(gv: TGraphView, nodes: Map<string, TGraphNode>) {
    this.state = gv;
    this.nodes = nodes;
    this.notifyListeners();
  }

  public getState(): TGraphView {
    return this.state;
  }
}

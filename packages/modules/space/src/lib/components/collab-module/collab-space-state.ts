import { TCoreSharedData, TEdge, TConnector, TGraphNode } from '@monorepo/core';

import { TSpaceSharedData } from '../../space-shared-model';
import { SpaceState } from '../apis/spaceState';
import { TNodeView, TConnectorView, TGraphView } from '../../space-types';

//

export class CollabSpaceState extends SpaceState {
  sd: TSpaceSharedData & TCoreSharedData;
  viewId: string;

  constructor(viewId: string, sd: TSpaceSharedData & TCoreSharedData) {
    super();
    this.sd = sd;
    this.viewId = viewId;
    this.sd.graphViews.observe(() => {
      this.notifyListeners();
    });
    this.sd.nodes.observe(() => {
      this.notifyListeners();
    });
    this.sd.edges.observe(() => {
      this.notifyListeners();
    });
  }

  private updateState() {
    const state = this.sd.graphViews.get(this.viewId);
    const nodes = this.sd.nodes;
    if (!state || !nodes) throw new Error('No state or nodes');
    this.state = state;
    this.nodes = nodes as unknown as Map<string, TGraphNode>;
  }

  override getNodes(): TNodeView[] {
    this.updateState();
    return super.getNodes();
  }

  override getEdges(): TEdge[] {
    this.updateState();
    return super.getEdges();
  }

  override getConnector(
    nodeId: string,
    connectorName: string
  ): (TConnector & TConnectorView) | undefined {
    this.updateState();
    return super.getConnector(nodeId, connectorName);
  }

  override setState(s: TGraphView, nodes: Map<string, TGraphNode>) {
    throw new Error('Do not setState on CollabSpaceState');
  }
}

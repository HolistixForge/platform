import { TCoreSharedData } from '@holistix-forge/core-graph';
import { TGraphNode } from '@holistix-forge/core-graph';
import { LocalOverrider } from '@holistix-forge/collab';

import { TWhiteboardSharedData } from '../..';
import { WhiteboardState } from './apis/whiteboardState';
import { TGraphView } from '../whiteboard-types';

//

export class CollabSpaceState extends WhiteboardState {
  sdm: LocalOverrider<TWhiteboardSharedData & TCoreSharedData>;
  viewId: string;

  constructor(
    viewId: string,
    sdm: LocalOverrider<TWhiteboardSharedData & TCoreSharedData>
  ) {
    super();
    this.sdm = sdm;
    this.viewId = viewId;

    this.sdm.observe(['whiteboard:graphViews'], () => {
      this.updateState();
      this.notifyListeners();
    });

    this.sdm.observe(['core-graph:nodes'], () => {
      this.updateNodes();
      this.notifyListeners();
    });

    this.sdm.observe(['core-graph:edges'], () => {
      this.notifyListeners();
    });

    this.updateState();
    this.updateNodes();
  }

  private updateState() {
    const state = this.sdm.getData()['whiteboard:graphViews'].get(this.viewId);
    if (state)
      // throw new Error(`No graphViews for viewId [${this.viewId}]`);
      this.state = state;
  }

  private updateNodes() {
    const nodes = this.sdm.getData()['core-graph:nodes'];
    if (!nodes) throw new Error('No nodes');
    this.nodes = nodes;
  }

  override setState(s: TGraphView, nodes: Map<string, TGraphNode>) {
    throw new Error('Do not setState on CollabSpaceState');
  }
}

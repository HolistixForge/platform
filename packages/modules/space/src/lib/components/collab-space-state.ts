import { TCoreSharedData } from '@holistix/core-graph';
import { TGraphNode } from '@holistix/core-graph';
import { LocalOverrider } from '@holistix/collab';

import { TSpaceSharedData } from '../..';
import { SpaceState } from './apis/spaceState';
import { TGraphView } from '../space-types';

//

export class CollabSpaceState extends SpaceState {
  sdm: LocalOverrider<TSpaceSharedData & TCoreSharedData>;
  viewId: string;

  constructor(
    viewId: string,
    sdm: LocalOverrider<TSpaceSharedData & TCoreSharedData>
  ) {
    super();
    this.sdm = sdm;
    this.viewId = viewId;

    this.sdm.observe(['space:graphViews'], () => {
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
    const state = this.sdm.getData()['space:graphViews'].get(this.viewId);
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

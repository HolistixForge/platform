import { TCoreSharedData } from '@monorepo/core';
import { TGraphNode } from '@monorepo/module';
import { SharedDataManager } from '@monorepo/collab-engine';

import { TSpaceSharedData } from '../space-shared-model';
import { SpaceState } from './apis/spaceState';
import { TGraphView } from '../space-types';

//

export class CollabSpaceState extends SpaceState {
  sdm: SharedDataManager<TSpaceSharedData & TCoreSharedData>;
  viewId: string;

  constructor(
    viewId: string,
    sdm: SharedDataManager<TSpaceSharedData & TCoreSharedData>
  ) {
    super();
    this.sdm = sdm;
    this.viewId = viewId;

    this.sdm.observe(['graphViews'], () => {
      this.updateState();
      this.notifyListeners();
    });

    this.sdm.observe(['nodes'], () => {
      this.updateNodes();
      this.notifyListeners();
    });

    this.sdm.observe(['edges'], () => {
      this.notifyListeners();
    });

    this.updateState();
    this.updateNodes();
  }

  private updateState() {
    const state = this.sdm.getData().graphViews.get(this.viewId);
    if (!state) throw new Error(`No graphViews for viewId [${this.viewId}]`);
    this.state = state;
  }

  private updateNodes() {
    const nodes = this.sdm.getData().nodes;
    if (!nodes) throw new Error('No nodes');
    this.nodes = nodes;
  }

  override setState(s: TGraphView, nodes: Map<string, TGraphNode>) {
    throw new Error('Do not setState on CollabSpaceState');
  }
}

import isEqual from 'lodash.isequal';

import { RequestData } from '@holistix-forge/reducers';
import {
  TCollabBackendExports,
  ReducerWithCollab,
} from '@holistix-forge/collab';

import {
  TEventNewNode,
  TEventDeleteNode,
  TEventNewEdge,
  TEventDeleteEdge,
  TCoreEvent,
} from './core-events';

import { TCoreSharedData, TEdge } from './core-types';

//

type TRequired = {
  collab: TCollabBackendExports;
};

export class CoreReducer extends ReducerWithCollab<
  TCoreEvent,
  TCoreSharedData
> {
  constructor(depsExports: TRequired) {
    super(depsExports.collab.registry, 'core-graph');
  }

  override reduce(event: TCoreEvent, requestData: RequestData): Promise<void> {
    switch (event.type) {
      case 'core:new-node':
        return this._newNode(event, requestData);

      case 'core:delete-node':
        return this._deleteNode(event, requestData);

      case 'core:new-edge':
        return this._newEdge(event, requestData);

      case 'core:delete-edge':
        return this._deleteEdge(event, requestData);

      default:
        return Promise.resolve();
    }
  }

  /**
   *
   */

  async _newNode(event: TEventNewNode, requestData: RequestData) {
    const nd = event.nodeData;
    const collab = this.getCollab(requestData);

    // add node data
    collab.sharedData['core-graph:nodes'].set(nd.id, nd);

    // add edges
    if (event.edges) {
      collab.sharedData['core-graph:edges'].push(event.edges);
    }
  }

  /**
   *
   */

  async _deleteNode(event: TEventDeleteNode, requestData: RequestData) {
    const id = event.id;
    const collab = this.getCollab(requestData);

    // delete all edges from or to this node
    collab.sharedData['core-graph:edges'].deleteMatching(
      (e: TEdge) => e.from.node === id || e.to.node === id
    );

    // delete node data
    collab.sharedData['core-graph:nodes'].delete(id);
  }

  /**
   *
   */

  _newEdge(event: TEventNewEdge, requestData: RequestData) {
    const collab = this.getCollab(requestData);
    collab.sharedData['core-graph:edges'].push([event.edge]);
    return Promise.resolve();
  }

  /**
   *
   */

  _deleteEdge(event: TEventDeleteEdge, requestData: RequestData) {
    const collab = this.getCollab(requestData);
    collab.sharedData['core-graph:edges'].deleteMatching((e: TEdge) =>
      isEqual(event.edge, e)
    );
    return Promise.resolve();
  }
}

import isEqual from 'lodash.isequal';

import { Reducer } from '@monorepo/reducers';
import { TCollabBackendExports } from '@monorepo/collab';

import {
  TEventNewNode,
  TEventDeleteNode,
  TEventNewEdge,
  TEventDeleteEdge,
  TCoreEvent,
} from './core-events';

import { TCoreSharedData } from './core-types';

//

type TRequired = {
  collab: TCollabBackendExports<TCoreSharedData>;
};

export class CoreReducer extends Reducer<TCoreEvent> {
  private readonly depsExports: TRequired;

  constructor(depsExports: TRequired) {
    super();
    this.depsExports = depsExports;
  }

  override reduce(event: TCoreEvent): Promise<void> {
    switch (event.type) {
      case 'core:new-node':
        return this._newNode(event);

      case 'core:delete-node':
        return this._deleteNode(event);

      case 'core:new-edge':
        return this._newEdge(event);

      case 'core:delete-edge':
        return this._deleteEdge(event);

      default:
        return Promise.resolve();
    }
  }

  /**
   *
   */

  async _newNode(event: TEventNewNode) {
    const nd = event.nodeData;

    // add node data
    this.depsExports.collab.collab.sharedData['core-graph:nodes'].set(
      nd.id,
      nd
    );

    // add edges
    if (event.edges) {
      this.depsExports.collab.collab.sharedData['core-graph:edges'].push(
        event.edges
      );
    }
  }

  /**
   *
   */

  async _deleteNode(event: TEventDeleteNode) {
    const id = event.id;

    // delete all edges from or to this node
    // console.log({ before: 'before', edges: edgesToStrings(sd.edges) });
    this.depsExports.collab.collab.sharedData[
      'core-graph:edges'
    ].deleteMatching((e) => e.from.node === id || e.to.node === id);

    // delete node data
    this.depsExports.collab.collab.sharedData['core-graph:nodes'].delete(id);
  }

  /**
   *
   */

  _newEdge(event: TEventNewEdge) {
    this.depsExports.collab.collab.sharedData['core-graph:edges'].push([
      event.edge,
    ]);
    return Promise.resolve();
  }

  /**
   *
   */

  _deleteEdge(event: TEventDeleteEdge) {
    this.depsExports.collab.collab.sharedData[
      'core-graph:edges'
    ].deleteMatching((e) => isEqual(event.edge, e));
    return Promise.resolve();
  }
}

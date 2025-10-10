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

export class CoreReducer extends Reducer<TCoreEvent, TRequired> {
  override reduce(event: TCoreEvent, depsExports: TRequired): Promise<void> {
    switch (event.type) {
      case 'core:new-node':
        return this._newNode(event, depsExports);

      case 'core:delete-node':
        return this._deleteNode(event, depsExports);

      case 'core:new-edge':
        return this._newEdge(event, depsExports);

      case 'core:delete-edge':
        return this._deleteEdge(event, depsExports);

      default:
        return Promise.resolve();
    }
  }

  /**
   *
   */

  async _newNode(event: TEventNewNode, depsExports: TRequired) {
    const nd = event.nodeData;

    // add node data
    depsExports.collab.collab.sharedData['core:nodes'].set(nd.id, nd);

    // add edges
    if (event.edges) {
      depsExports.collab.collab.sharedData['core:edges'].push(event.edges);
    }
  }

  /**
   *
   */

  async _deleteNode(event: TEventDeleteNode, depsExports: TRequired) {
    const id = event.id;

    // delete all edges from or to this node
    // console.log({ before: 'before', edges: edgesToStrings(sd.edges) });
    depsExports.collab.collab.sharedData['core:edges'].deleteMatching(
      (e) => e.from.node === id || e.to.node === id
    );

    // delete node data
    depsExports.collab.collab.sharedData['core:nodes'].delete(id);
  }

  /**
   *
   */

  _newEdge(event: TEventNewEdge, depsExports: TRequired) {
    depsExports.collab.collab.sharedData['core:edges'].push([event.edge]);
    return Promise.resolve();
  }

  /**
   *
   */

  _deleteEdge(event: TEventDeleteEdge, depsExports: TRequired) {
    depsExports.collab.collab.sharedData['core:edges'].deleteMatching((e) =>
      isEqual(event.edge, e)
    );
    return Promise.resolve();
  }
}

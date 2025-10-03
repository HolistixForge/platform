import isEqual from 'lodash.isequal';

import { Reducer } from '@monorepo/reducers';
import { TCollabExports } from '@monorepo/collab';

import {
  TEventNewNode,
  TEventDeleteNode,
  TEventNewEdge,
  TEventDeleteEdge,
  TCoreEvent,
} from './core-events';

import { TCoreSharedData } from './core-types';

//

export class CoreReducer extends Reducer<
  TCoreEvent,
  TCollabExports<TCoreSharedData>
> {
  override reduce(
    event: TCoreEvent,
    depsExports: TCollabExports<TCoreSharedData>
  ): Promise<void> {
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

  async _newNode(
    event: TEventNewNode,
    depsExports: TCollabExports<TCoreSharedData>
  ) {
    const nd = event.nodeData;

    // add node data
    depsExports.sharedData['core:nodes'].set(nd.id, nd);

    // add edges
    if (event.edges) {
      depsExports.sharedData['core:edges'].push(event.edges);
    }
  }

  /**
   *
   */

  async _deleteNode(
    event: TEventDeleteNode,
    depsExports: TCollabExports<TCoreSharedData>
  ) {
    const id = event.id;

    // delete all edges from or to this node
    // console.log({ before: 'before', edges: edgesToStrings(sd.edges) });
    depsExports.sharedData['core:edges'].deleteMatching(
      (e) => e.from.node === id || e.to.node === id
    );

    // delete node data
    depsExports.sharedData['core:nodes'].delete(id);
  }

  /**
   *
   */

  _newEdge(event: TEventNewEdge, depsExports: TCollabExports<TCoreSharedData>) {
    depsExports.sharedData['core:edges'].push([event.edge]);
    return Promise.resolve();
  }

  /**
   *
   */

  _deleteEdge(
    event: TEventDeleteEdge,
    depsExports: TCollabExports<TCoreSharedData>
  ) {
    depsExports.sharedData['core:edges'].deleteMatching((e) =>
      isEqual(event.edge, e)
    );
    return Promise.resolve();
  }
}

import isEqual from 'lodash.isequal';
import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import {
  TCoreEvent,
  TEventNewNode,
  TEventDeleteNode,
  TEventNewEdge,
  TEventDeleteEdge,
} from './core-events';
import { TCoreSharedData } from './core-shared-model';
//

type ReducedEvents = TCoreEvent;

type UsedSharedData = TCoreSharedData;

type Ra<T> = ReduceArgs<UsedSharedData, T, undefined, undefined>;

/**
 *
 */

export class CoreReducer extends Reducer<
  UsedSharedData,
  ReducedEvents,
  undefined,
  undefined
> {
  //

  reduce(g: Ra<ReducedEvents>): Promise<void> {
    switch (g.event.type) {
      case 'core:new-node':
        return this._newNode(g as Ra<TEventNewNode>);

      case 'core:delete-node':
        return this._deleteNode(g as Ra<TEventDeleteNode>);

      case 'core:new-edge':
        return this._newEdge(g as Ra<TEventNewEdge>);

      case 'core:delete-edge':
        return this._deleteEdge(g as Ra<TEventDeleteEdge>);

      default:
        return Promise.resolve();
    }
  }

  /**
   *
   */

  async _newNode(g: Ra<TEventNewNode>) {
    const nd = g.event.nodeData;

    // add node data
    g.sd.nodes.set(nd.id, nd);

    // add edges
    if (g.event.edges) {
      g.sd.edges.push(g.event.edges);
    }

    this._dispatchUpdateAllGraphViews(g);
  }

  /**
   *
   */

  async _deleteNode(g: Ra<TEventDeleteNode>) {
    const id = g.event.id;

    // delete all edges from or to this node
    // console.log({ before: 'before', edges: edgesToStrings(sd.edges) });
    g.sd.edges.deleteMatching((e) => e.from.node === id || e.to.node === id);

    // delete node data
    g.sd.nodes.delete(id);

    this._dispatchUpdateAllGraphViews(g);
  }

  /**
   *
   */

  _newEdge(g: Ra<TEventNewEdge>) {
    g.sd.edges.push([g.event.edge]);
    this._dispatchUpdateAllGraphViews(g);
    return Promise.resolve();
  }

  /**
   *
   */

  _deleteEdge(g: Ra<TEventDeleteEdge>) {
    g.sd.edges.deleteMatching((e) => isEqual(g.event.edge, e));
    this._dispatchUpdateAllGraphViews(g);
    return Promise.resolve();
  }

  /**
   *
   */

  _dispatchUpdateAllGraphViews(g: Ra<any>) {
    /*
    g.sd.graphViews.forEach((gv, k) => {
      g.dispatcher.dispatch({
        type: 'space-action',
        viewId: k,
        action: {
          type: 'update-graph-view',
        },
      });
    });
    */
    console.log('TODO_DEM');
  }
}

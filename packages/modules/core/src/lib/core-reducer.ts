import isEqual from 'lodash.isequal';
import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import {
  TCoreEvent,
  TEventNewNode,
  TEventDeleteNode,
  TEventNewEdge,
  TEventDeleteEdge,
  TEventLoad,
} from './core-events';
import { TCoreSharedData } from './core-shared-model';
import { GATEWAY_INACIVITY_SHUTDOWN_DELAY } from './meta-reducer';
import { inSeconds } from '@monorepo/simple-types';
//

type ReducedEvents = TCoreEvent;

type UsedSharedData = TCoreSharedData;

type Ra<T> = ReduceArgs<
  UsedSharedData,
  T,
  Record<string, never>,
  undefined,
  undefined
>;

/**
 *
 */

export class CoreReducer extends Reducer<
  UsedSharedData,
  ReducedEvents,
  Record<string, never>,
  undefined,
  undefined
> {
  //

  reduce(g: Ra<ReducedEvents>): Promise<void> {
    switch (g.event.type) {
      case 'core:load':
        return this._load(g as Ra<TEventLoad>);

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

  async _load(g: Ra<TEventLoad>) {
    const disable_gateway_shutdown =
      g.sd.meta.get('meta')?.projectActivity.disable_gateway_shutdown || false;

    const newMeta = {
      projectActivity: {
        last_activity: new Date().toISOString(),
        gateway_shutdown: inSeconds(
          GATEWAY_INACIVITY_SHUTDOWN_DELAY,
          new Date()
        ).toISOString(),
        disable_gateway_shutdown,
      },
    };

    g.sd.meta.set('meta', newMeta);
    return Promise.resolve();
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
  }

  /**
   *
   */

  _newEdge(g: Ra<TEventNewEdge>) {
    g.sd.edges.push([g.event.edge]);
    return Promise.resolve();
  }

  /**
   *
   */

  _deleteEdge(g: Ra<TEventDeleteEdge>) {
    g.sd.edges.deleteMatching((e) => isEqual(g.event.edge, e));
    return Promise.resolve();
  }
}

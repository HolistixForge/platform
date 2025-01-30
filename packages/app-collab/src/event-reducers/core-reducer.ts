import isEqual from 'lodash.isequal';
import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { TDemiurgeSpaceEvent } from './graphviews-reducer';
import {
  TSpaceSharedData,
  TGraphView,
  TCoreSharedData,
  TGraphNode,
} from '@monorepo/shared-data-model';
import { TEdge, TPosition } from '@monorepo/demiurge-ui-components';

/**
 *
 */

type TEventOrigin = {
  viewId: string;
  position: TPosition;
};

export type TEventNewNode = {
  type: 'new-node';
  nodeData: TGraphNode;
  edges: TEdge[];
  origin?: TEventOrigin;
};

export type TEventDeleteNode = {
  type: 'delete-node';
  id: string;
};

export type TEventNewEdge = {
  type: 'new-edge';
  edge: TEdge;
};

export type TEventDeleteEdge = {
  type: 'delete-edge';
  edge: TEdge;
};

export type TEventNewView = {
  type: 'new-view';
  viewId: string;
};

export type TCoreEvent =
  | TEventNewNode
  | TEventDeleteNode
  | TEventNewView
  | TEventNewEdge
  | TEventDeleteEdge;

//

type TExtraArgs = {};

type ReducedEvents = TCoreEvent;

type DispatchedEvents = TDemiurgeSpaceEvent;

type UsedSharedData = TCoreSharedData & TSpaceSharedData;

type Ra<T> = ReduceArgs<UsedSharedData, T, DispatchedEvents, TExtraArgs>;

/**
 *
 */

export class CoreReducer extends Reducer<
  UsedSharedData,
  ReducedEvents,
  DispatchedEvents,
  TExtraArgs
> {
  //

  reduce(g: Ra<ReducedEvents>): Promise<void> {
    switch (g.event.type) {
      case 'new-node':
        return this._newNode(g as Ra<TEventNewNode>);
      case 'delete-node':
        return this._deleteNode(g as Ra<TEventDeleteNode>);
      case 'new-view':
        return this._newView(g as Ra<TEventNewView>);
      case 'new-edge':
        return this._newEdge(g as Ra<TEventNewEdge>);
      case 'delete-edge':
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
    g.sd.graphViews.forEach((gv, k) => {
      g.dispatcher.dispatch({
        type: 'space-action',
        viewId: k,
        action: {
          type: 'update-graph-view',
        },
      });
    });
  }

  /**
   *
   */

  _newView(g: Ra<TEventNewView>) {
    const nv: TGraphView = {
      params: {
        maxRank: 2,
      },
      nodeViews: [],
      graph: {
        nodes: [],
        edges: [],
      },
      roots: [],
    };
    g.sd.graphViews.set(g.event.viewId, nv);

    g.dispatcher.dispatch({
      type: 'space-action',
      viewId: g.event.viewId,
      action: {
        type: 'update-graph-view',
      },
    });

    return Promise.resolve();
  }

  //
  /*
  _newChat(g: Ra<TEventNewChat>): Promise<void> {
    console.log({ event: g.event });

    const nca: TNodeData = {
      type: 'chat-anchor',
      id: makeUuid(),
      chatId: g.event.__private__.id,
    };

    const nc: TNodeData = {
      type: 'chat',
      id: makeUuid(),
      chatId: g.event.__private__.id,
    };

    const edge: TEdgeChatAnchor = {
      from: {
        node: nca.id,
      },
      to: {
        node: nc.id,
      },
      type: 'REFERENCE',
      data: {
        demiurge_type: 'chat-anchor',
      },
    };

    newNode(g.sd, nca, g.event.position, true);

    newNode(
      g.sd,
      nc,
      { x: g.event.position.x + 150, y: g.event.position.y - 150 },
      false,
      [edge]
    );

    dispatchUpdateAllGraphViews(g, 'new-chat');
    return Promise.resolve();
  }
  */
}

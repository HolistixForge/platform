import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { TDemiurgeSpaceEvent } from './graphviews-reducer';
import {
  TSpaceSharedData,
  TGraphView,
  TCoreSharedData,
} from '@monorepo/shared-data-model';
import { makeUuid } from '@monorepo/simple-types';
import {
  TEdge,
  nodeViewDefaultStatus,
  TPosition,
} from '@monorepo/demiurge-ui-components';

/**
 *
 */

type TEventOrigin = {
  viewId: string;
  position: TPosition;
};

export type TEventNewNode = {
  type: 'new-node';
  nodeData: { type: string };
  rootNode?: boolean;
  edge: Omit<TEdge, 'to'>;
} & TEventOrigin;

export type TEventDeleteNode = {
  type: 'delete-node';
  id: string;
};

export type TEventNewView = {
  type: 'new-view';
  viewId: string;
};

type TDemiurgeGraphEvent = TEventNewNode | TEventDeleteNode | TEventNewView;

//

export type TExtraArgs = {};

type ReducedEvents = TDemiurgeGraphEvent;

type DispatchedEvents = TDemiurgeSpaceEvent;

type UsedSharedData = TCoreSharedData & TSpaceSharedData;

type Ra<T> = ReduceArgs<UsedSharedData, T, DispatchedEvents, TExtraArgs>;

/**
 *
 */

export class GraphReducer extends Reducer<
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
      default:
        return Promise.resolve();
    }
  }

  /**
   *
   */

  async _newNode(g: Ra<TEventNewNode>) {
    const nd = { id: makeUuid(), ...g.event.nodeData };

    const edges: TEdge[] = g.event.edge
      ? [
          {
            ...g.event.edge,
            to: {
              node: nd.id,
              connectorName: 'inputs',
            },
          },
        ]
      : [];

    // add node data
    g.sd.nodeData.set(nd.id, nd);

    // add this node to each view
    g.sd.graphViews.forEach((gv, k) => {
      const ngv = { ...gv };
      ngv.nodeViews = [
        ...ngv.nodeViews,
        {
          id: nd.id,
          position: g.event.position,
          status: nodeViewDefaultStatus(),
        },
      ];

      if (g.event.rootNode) ngv.roots = [...ngv.roots, nd.id];

      g.sd.graphViews.set(k, ngv);
    });
    // add edges
    if (edges) {
      g.sd.edges.push(edges);
    }

    this._dispatchUpdateAllGraphViews(g);
    return;
  }

  /**
   *
   */

  async _deleteNode(g: Ra<TEventDeleteNode>) {
    const id = g.event.id;

    // delete all edges from or to this node
    // console.log({ before: 'before', edges: edgesToStrings(sd.edges) });
    g.sd.edges.deleteMatching((e) => e.from.node === id || e.to.node === id);
    // console.log({ after: 'after', edges: edgesToStrings(sd.edges) });
    // delete this node in each view
    g.sd.graphViews.forEach((gv, k) => {
      const ngv = structuredClone(gv);
      const index = ngv.nodeViews.findIndex((nv) => nv.id === id);
      if (index !== -1) {
        ngv.nodeViews.splice(index, 1);
        g.sd.graphViews.set(k, ngv);
      }
    });
    // delete node data
    g.sd.nodeData.delete(id);

    this._dispatchUpdateAllGraphViews(g);
    return;
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

import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import {
  TCoreEvent,
  TCoreSharedData,
  TEdge,
  TEventNewNode,
  TGraphNode,
} from '@monorepo/core';
import { error } from '@monorepo/log';

import { TSpaceSharedData } from './space-shared-model';
import {
  TSpaceEvent,
  TEventNewView,
  TEventSpaceAction,
  TEventNewGroup,
} from './space-events';
import {
  defaultGraphView,
  nodeViewDefaultStatus,
  TGraphView,
} from './space-types';
import { SpaceActionsReducer } from './components/apis/spaceActionsReducer';

/**
 *
 */

type ReducedEvents = TSpaceEvent | TCoreEvent;

type Ra<T> = ReduceArgs<
  TSpaceSharedData & TCoreSharedData,
  T,
  ReducedEvents,
  undefined
>;

/**
 *
 */

export class SpaceReducer extends Reducer<
  TSpaceSharedData & TCoreSharedData,
  ReducedEvents,
  TSpaceEvent,
  undefined
> {
  //
  spaceActionReducer: SpaceActionsReducer = new SpaceActionsReducer();

  reduce(g: Ra<ReducedEvents>) {
    switch (g.event.type) {
      case 'space:new-view':
        return this.newView(g as Ra<TEventNewView>);

      case 'space:action':
        this.spaceAction(g as Ra<TEventSpaceAction>);
        return Promise.resolve();

      case 'space:new-group':
        this.newGroup(g as Ra<TEventNewGroup>);
        return Promise.resolve();

      case 'core:delete-edge':
      case 'core:delete-node':
      case 'core:new-edge':
        this.updateAllGraphviews(g);
        return Promise.resolve();

      case 'core:new-node':
        this.newNode(g as Ra<TEventNewNode>);
        this.updateAllGraphviews(g);
        return Promise.resolve();

      default:
        return Promise.resolve();
    }
  }

  //

  newGroup(g: Ra<TEventNewGroup>) {
    g.dispatcher.dispatch({
      type: 'core:new-node',
      nodeData: {
        name: `group ${g.event.title}`,
        root: true,
        connectors: [],
        id: g.event.groupId,
        type: 'group',
        data: { title: g.event.title },
      },
      edges: [],
      origin: g.event.origin,
    });
  }

  //

  newNode(g: Ra<TEventNewNode>) {
    g.sd.graphViews.forEach((gv, k) => {
      gv.nodeViews.push({
        id: g.event.nodeData.id,
        position:
          g.event.origin?.viewId === k && g.event.origin?.position
            ? g.event.origin?.position
            : { x: 0, y: 0 },
        status: nodeViewDefaultStatus(),
      });
    });
  }

  //

  spaceAction(g: Ra<TEventSpaceAction>) {
    const gv = g.sd.graphViews.get(g.event.viewId)!;
    if (!gv) {
      error('SPACE', `graphview ${g.event.viewId} not found`);
      return;
    }
    const gvc = structuredClone(gv);
    const nodes = g.sd.nodes as unknown as Map<string, TGraphNode>;
    this.spaceActionReducer.reduce(
      g.event.action,
      gvc,
      nodes,
      g.sd.edges as unknown as TEdge[]
    );
    g.sd.graphViews.set(g.event.viewId, gvc);
  }

  //

  newView(g: Ra<TEventNewView>) {
    const nv: TGraphView = defaultGraphView();
    g.sd.graphViews.set(g.event.viewId, nv);

    g.dispatcher.dispatch({
      type: 'space:action',
      viewId: g.event.viewId,
      action: {
        type: 'update-graph-view',
      },
    });

    return Promise.resolve();
  }

  //

  updateAllGraphviews(g: Ra<ReducedEvents>) {
    g.sd.graphViews.forEach((gv, k) => {
      g.dispatcher.dispatch({
        type: 'space:action',
        viewId: k,
        action: {
          type: 'update-graph-view',
        },
      });
    });
  }
}

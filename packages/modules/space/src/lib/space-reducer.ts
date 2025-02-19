import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { TCoreEvent, TCoreSharedData, TEdge, TGraphNode } from '@monorepo/core';

import { TSpaceSharedData } from './space-shared-model';
import { TSpaceEvent, TEventNewView, TEventSpaceAction } from './space-events';
import { defaultGraphView, TGraphView } from './space-types';
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
        return this._newView(g as Ra<TEventNewView>);

      case 'space:action':
        this._spaceAction(g as Ra<TSpaceEvent>);
        return Promise.resolve();

      case 'core:delete-edge':
      case 'core:delete-node':
      case 'core:new-edge':
      case 'core:new-node':
        this.updateAllGraphviews(g);

        return Promise.resolve();

      default:
        return Promise.resolve();
    }
  }

  //

  _spaceAction(g: Ra<TSpaceEvent>) {
    const gv = g.sd.graphViews.get(g.event.viewId)!;
    const gvc = structuredClone(gv);
    const nodes = g.sd.nodes as unknown as Map<string, TGraphNode>;
    this.spaceActionReducer.reduce(
      (g.event as TEventSpaceAction).action,
      gvc,
      nodes,
      g.sd.edges as unknown as TEdge[]
    );
    g.sd.graphViews.set(g.event.viewId, gvc);
  }

  //

  _newView(g: Ra<TEventNewView>) {
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

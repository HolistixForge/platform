import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { TSpaceSharedData } from './space-shared-model';
import { TSpaceEvent, TEventNewView } from './space-events';
import { TGraphView } from './space-types';

/**
 *
 */

type Ra<T> = ReduceArgs<TSpaceSharedData, T, TSpaceEvent, undefined>;

/**
 *
 */

export class SpaceReducer extends Reducer<
  TSpaceSharedData,
  TSpaceEvent,
  TSpaceEvent,
  undefined
> {
  //

  reduce(g: Ra<TSpaceEvent>) {
    switch (g.event.type) {
      case 'space:new-view':
        return this._newView(g as Ra<TEventNewView>);

      case 'space:action':
        console.log('TODO_DEM');
        return Promise.resolve();

      default:
        return Promise.resolve();
    }
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
}

//

export const defaultGraphView = (): TGraphView => ({
  params: {
    maxRank: 2,
    roots: [],
  },
  nodeViews: [],
  graph: {
    nodes: [],
    edges: [],
  },
});

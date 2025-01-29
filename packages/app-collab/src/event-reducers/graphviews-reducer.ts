import { NotFoundException } from '@monorepo/backend-engine';
import { ReduceArgs, Reducer } from '@monorepo/collaborative';
import {
  isNodeOpened,
  nodeViewDefaultStatus,
  TDemiurgeSpaceSharedData,
  TEdge,
  TGraphView,
  TNodeView,
  TNodeViewStatus,
  TDemiurgeSpaceEvent,
  TEventMoveNode,
  TEventOpenNode,
  TEventCloseNode,
  TEventUpdateGraphView,
  TEventReduceNode,
  TEventExpandNode,
  viewGraphTraversal,
  ENodeViewMode,
  TDemiurgeEdge,
} from '@monorepo/demiurge-types';
import { log } from '@monorepo/log';

/**
 *
 */

type Ra<T> = ReduceArgs<
  TDemiurgeSpaceSharedData,
  T,
  undefined,
  Record<string, never>
>;

/**
 *
 */

export class GraphViewsReducer extends Reducer<
  TDemiurgeSpaceSharedData,
  TDemiurgeSpaceEvent,
  undefined,
  Record<string, never>
> {
  //

  reduce(g: Ra<TDemiurgeSpaceEvent>) {
    switch (g.event.type) {
      case 'close-node':
        return this._openCloseNode(g as Ra<TEventCloseNode>, false);

      case 'open-node':
        return this._openCloseNode(g as Ra<TEventOpenNode>, true);

      case 'reduce-node':
        return this._reduceExpandNode(g as Ra<TEventReduceNode>, 'REDUCED');

      case 'expand-node':
        return this._reduceExpandNode(g as Ra<TEventExpandNode>, 'EXPANDED');

      case 'move-node':
        return this._moveNode(g as Ra<TEventMoveNode>);

      case '_update-graph-view_':
        return this._justUpdateGraphViews(g as Ra<TEventUpdateGraphView>);

      default:
        return Promise.resolve();
    }
  }

  //
  //
  //

  _updateGraphView(why: string, gv: TGraphView, allEdges: TDemiurgeEdge[]) {
    const doContinue = (
      node: TNodeView,
      edge: TEdge | undefined,
      rank: number
    ): boolean => {
      // first call, node.status may be undefined
      const s = node.status || nodeViewDefaultStatus();
      return isNodeOpened({ ...s, rank, maxRank: gv.params.maxRank });
    };

    const { ranks, nodes, edges } = viewGraphTraversal(
      gv.nodeViews,
      allEdges,
      doContinue,
      gv.roots
    );

    nodes.forEach((n) => {
      const rank = ranks.get(n.id) as number;
      const s = { rank, maxRank: gv.params.maxRank };
      this._updateNodeStatus(n, s);
    });

    gv.nodeViews.forEach((n) => {
      if (n.standalone) nodes.push(n);
    });

    log(7, 'GRAPHVIEWS_REDUCER', `_updateGraphView: [${why}]`, {
      nodes,
      edges,
    });

    gv.graph = {
      nodes,
      edges,
    };
  }

  //

  __deepCopyEditAndApply(
    g: Ra<{ viewId: string; nid?: string; why?: string }>,
    f: (gv: TGraphView, nv: TNodeView | null) => void
  ) {
    const gv = g.sd.graphViews.get(g.event.viewId);
    if (!gv) {
      const message = `view [${g.event.viewId}] not found`;
      log(4, 'GRAPHVIEWS_REDUCER', message);
      throw new NotFoundException([{ message }]);
    }

    const ngv = structuredClone(gv);

    let nv = null;

    if (g.event.nid) {
      nv = ngv.nodeViews.find((nv) => nv.id === g.event.nid);
      if (!nv) {
        const message = `node [${g.event.nid}] not found in view [${g.event.viewId}]`;
        log(4, 'GRAPHVIEWS_REDUCER', message);
        throw new NotFoundException([{ message }]);
      }
    }

    f(ngv, nv);

    this._updateGraphView(g.event.why || 'unknown', ngv, g.sd.edges.toArray());

    g.sd.graphViews.set(g.event.viewId, ngv);
  }

  //

  _justUpdateGraphViews(g: Ra<TEventUpdateGraphView>) {
    this.__deepCopyEditAndApply(g, (gv) => {});
    return Promise.resolve();
  }

  //

  _moveNode(g: Ra<TEventMoveNode>): Promise<void> {
    this.__deepCopyEditAndApply(g, (gv, nv) => {
      nv.position = g.event.position;
    });
    return Promise.resolve();
  }

  //

  _openCloseNode(
    g: Ra<TEventOpenNode | TEventCloseNode>,
    isOpen: boolean
  ): Promise<void> {
    this.__deepCopyEditAndApply(g, (gv, nv) => {
      const s = isOpen
        ? {
            forceClosed: false,
            forceOpened: true,
          }
        : {
            forceClosed: true,
            forceOpened: false,
          };
      this._updateNodeStatus(nv, s);
    });
    return Promise.resolve();
  }

  //

  _reduceExpandNode(
    g: Ra<TEventReduceNode | TEventExpandNode>,
    mode: ENodeViewMode
  ): Promise<void> {
    this.__deepCopyEditAndApply(g, (gv, nv) => {
      this._updateNodeStatus(nv, { mode });
    });
    return Promise.resolve();
  }

  //

  _updateNodeStatus(node: TNodeView, newStatus: Partial<TNodeViewStatus>) {
    if (!node.status) node.status = nodeViewDefaultStatus();
    node.status = { ...node.status, ...newStatus };
  }

  //
}

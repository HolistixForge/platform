import { TGraphView } from '../whiteboard-types';

/**
 * Drops the view state of nodes that no longer exist in the core graph.
 *
 * `nodeViews` deliberately outlives display — it keeps a node's position and
 * open/closed choice around for when the node comes back into the extract, so
 * `updateGraphview()` rebuilding `graph.nodes` is not enough to release it. A
 * node deleted from the core graph never comes back, so without this its view
 * entry (and its connector views) would accumulate for the life of the project.
 *
 * @param gv The graph view to purge, mutated in place
 * @param nodeExists Whether a node id is still present in the core graph. Takes
 *   a predicate rather than the node map because the caller holds a `SharedMap`
 *   cast to `Map`: it has `get`, but no `has`.
 */
export function purgeDeletedNodeViews(
  gv: TGraphView,
  nodeExists: (nodeId: string) => boolean
) {
  const kept = gv.nodeViews.filter((n) => nodeExists(n.id));
  if (kept.length !== gv.nodeViews.length) gv.nodeViews = kept;

  for (const nodeView of gv.nodeViews) {
    // A group can be deleted without going through `deleteGroup` (which
    // detaches its children first). A dangling parentId makes React Flow
    // render an orphan whose parent is never mounted.
    if (nodeView.parentId && !nodeExists(nodeView.parentId)) {
      delete nodeView.parentId;
    }
  }

  for (const nodeId of Object.keys(gv.connectorViews)) {
    if (!nodeExists(nodeId)) delete gv.connectorViews[nodeId];
  }
}

import { TGraphView, TNodeView } from '../whiteboard-types';
import { getAbsolutePosition } from './position-utils';

/** Taken off the node rather than imported: `position-utils` next door stays
 * free of cross-package imports too, and the module boundary rule flags them. */
type TPosition = TNodeView['position'];

/**
 * Every node below `nid` in the group hierarchy.
 *
 * Used to keep a node from being dropped into one of its own groups, which
 * would make the hierarchy cyclic. The `has` guard is what stops the recursion
 * if the data already contains such a cycle.
 */
export const getDescendants = (
  nid: string,
  gv: TGraphView,
  descendants: Set<string> = new Set()
): Set<string> => {
  for (const node of gv.nodeViews) {
    if (node.parentId === nid && !descendants.has(node.id)) {
      descendants.add(node.id);
      getDescendants(node.id, gv, descendants);
    }
  }
  return descendants;
};

//

type TCandidateGroup = {
  id: string;
  absPosition: TPosition;
  area: number;
};

/**
 * The smallest group whose box contains `absolutePosition`, ignoring the moved
 * node itself and anything nested under it. Smallest wins so that dropping into
 * a group nested inside another lands in the inner one.
 */
const findTargetGroup = (
  gv: TGraphView,
  nodeId: string,
  absolutePosition: TPosition
): TCandidateGroup | undefined => {
  const candidates = new Map<string, TCandidateGroup>();

  gv.graph.nodes
    .filter((n) => n.type === 'group' && n.id !== nodeId)
    .forEach((group) => {
      if (!group.position || !group.size) return;

      const groupAbsolutePos = getAbsolutePosition(
        group.position,
        group.parentId,
        gv
      );

      if (
        absolutePosition.x >= groupAbsolutePos.x &&
        absolutePosition.x <= groupAbsolutePos.x + group.size.width &&
        absolutePosition.y >= groupAbsolutePos.y &&
        absolutePosition.y <= groupAbsolutePos.y + group.size.height
      ) {
        candidates.set(group.id, {
          id: group.id,
          absPosition: groupAbsolutePos,
          area: group.size.width * group.size.height,
        });
      }
    });

  getDescendants(nodeId, gv).forEach((c) => candidates.delete(c));

  if (candidates.size === 0) return undefined;

  return Array.from(candidates.values()).reduce((smallest, current) =>
    current.area < smallest.area ? current : smallest
  );
};

//

export type TNodePlacement = {
  position: TPosition;
  /** The group the node belongs to, or `undefined` for a free node. */
  parentId?: string;
};

/**
 * Where a node lands after a move event.
 *
 * A drag position always arrives in the frame the node was *rendered* in:
 * relative to its group when it has one, absolute otherwise. Group membership
 * is therefore only re-evaluated on the last event of a drag — re-evaluating it
 * on every intermediate event reparented the node mid-drag, so the next event
 * arrived in a frame the receiver no longer expected and the node jumped back
 * and forth between stale positions for the rest of the gesture.
 *
 * The reducer and the frontend's optimistic override both resolve moves here,
 * so the two can never disagree about which frame a position is in.
 */
export const resolveNodeMove = (
  gv: TGraphView,
  node: TNodeView,
  position: TPosition,
  /** True on the event that ends a drag. */
  stop: boolean
): TNodePlacement => {
  // Mid-drag the node keeps its group, so the incoming position already is in
  // the right frame and needs no conversion at all. It is still copied: the
  // caller's object belongs to React Flow's drag state and would alias into the
  // shared data.
  if (!stop) return { position: { ...position }, parentId: node.parentId };

  const absolutePosition = getAbsolutePosition(position, node.parentId, gv);

  const target = node.disabledFeatures?.includes('grouping')
    ? undefined
    : findTargetGroup(gv, node.id, absolutePosition);

  if (!target) return { position: absolutePosition, parentId: undefined };

  return {
    position: {
      x: absolutePosition.x - target.absPosition.x,
      y: absolutePosition.y - target.absPosition.y,
    },
    parentId: target.id,
  };
};

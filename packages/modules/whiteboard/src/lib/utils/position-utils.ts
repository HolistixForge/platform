import { TGraphView } from '../whiteboard-types';

/**
 * Calculates the absolute position of a node considering all parent groups
 * @param position The position relative to the parent
 * @param parentId The ID of the parent node
 * @param gv The graph view containing the node hierarchy
 * @returns The absolute position
 */
export function getAbsolutePosition(
  position: { x: number; y: number },
  parentId: string | undefined,
  gv: TGraphView
) {
  let absolutePosition = { ...position };
  let currentParentId = parentId;

  while (currentParentId) {
    const currentParent = gv.nodeViews.find(
      (n: any) => n.id === currentParentId
    );
    if (currentParent?.position) {
      absolutePosition.x += currentParent.position.x;
      absolutePosition.y += currentParent.position.y;
      currentParentId = currentParent.parentId;
    } else {
      break;
    }
  }

  return absolutePosition;
}

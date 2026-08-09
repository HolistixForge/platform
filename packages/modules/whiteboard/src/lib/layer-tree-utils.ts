import { TNodeView } from './whiteboard-types';
import { TLayerTreeItem } from './layer-tree-types';

/**
 * Builds hierarchical node tree from flat node array
 */
export function buildNodeTree(
  graphNodes: TNodeView[],
  allNodeViews: TNodeView[]
): TLayerTreeItem[] {
  // Create a map for quick lookup
  const nodeMap = new Map<string, TNodeView>();
  allNodeViews.forEach((node) => nodeMap.set(node.id, node));

  // Find root nodes (nodes without parentId or with parentId not in current graph)
  const rootNodes = graphNodes.filter(
    (node) => !node.parentId || !graphNodes.some((n) => n.id === node.parentId)
  );

  // Build tree recursively
  return rootNodes.map((node) => buildNodeTreeItem(node, graphNodes, nodeMap));
}

/**
 * Recursively builds a tree item for a node and its children
 */
function buildNodeTreeItem(
  node: TNodeView,
  graphNodes: TNodeView[],
  nodeMap: Map<string, TNodeView>
): TLayerTreeItem {
  // Find children of this node
  const children = graphNodes.filter((n) => n.parentId === node.id);

  // Build children recursively
  const childItems = children.map((child) =>
    buildNodeTreeItem(child, graphNodes, nodeMap)
  );

  // Determine if this is a group
  const isGroup = node.type === 'group';

  // Determine visibility based on node status
  const isVisible = !node.status.isFiltered;

  // Determine if expanded (for groups)
  const isExpanded = isGroup; // Groups are expanded by default

  // Determine if locked
  const isLocked = !!node.lockedBy;

  return {
    id: node.id,
    type: isGroup ? 'group' : 'node',
    title: `${node.type} ${node.id.slice(0, 8)}`,
    level: getNodeLevel(node, nodeMap),
    visible: isVisible,
    expanded: isExpanded,
    locked: isLocked,
    children: childItems.length > 0 ? childItems : undefined,
    nodeData: node,
    layerId: 'reactflow',
  };
}

/**
 * Calculates the nesting level of a node
 */
function getNodeLevel(
  node: TNodeView,
  nodeMap: Map<string, TNodeView>
): number {
  let level = 1; // Start at level 1 (under the layer)
  let currentNode = node;

  while (currentNode.parentId) {
    const parent = nodeMap.get(currentNode.parentId);
    if (!parent) break;
    level++;
    currentNode = parent;
  }

  return level;
}

/*
 * The two flatteners that used to live here are gone with the panel that
 * needed them.
 *
 * They turned the tree into a list and wrote the depth into a margin, because
 * the panel drew a flat list. It draws a tree now — `LayerTree` walks the
 * children itself and skips whole branches that are shut, which a
 * pre-flattened list cannot do: everything is already in it by the time
 * anyone asks what is open.
 */

import { TNodeView } from './space-types';
import { TLayerTreeItem, TLayerTreeCollection } from './layer-tree-types';

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

/**
 * Flattens tree structure for rendering
 */
export function flattenTreeItems(items: TLayerTreeItem[]): TLayerTreeItem[] {
  const flattened: TLayerTreeItem[] = [];

  function flatten(items: TLayerTreeItem[]) {
    for (const item of items) {
      flattened.push(item);
      if (item.children && item.expanded) {
        flatten(item.children);
      }
    }
  }

  flatten(items);
  return flattened;
}

/**
 * Flattens layer tree collection for rendering
 */
export function flattenLayerTreeCollection(
  collection: TLayerTreeCollection,
  activeLayerId: string | null
): TLayerTreeItem[] {
  const flattened: TLayerTreeItem[] = [];

  for (const layer of collection.layers) {
    // Add layer header
    flattened.push({
      id: layer.layerId,
      type: 'layer',
      title: layer.title,
      level: 0,
      visible: layer.layerId === activeLayerId,
      expanded: true,
      locked: false,
      layerId: layer.layerId,
    });

    // Add layer items
    if (layer.items.length > 0) {
      const layerItems = flattenTreeItems(layer.items);
      flattened.push(...layerItems);
    }
  }

  return flattened;
}

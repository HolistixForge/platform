import { TNodeView } from './whiteboard-types';

// Tree item types for the layer tree panel
export type TLayerTreeItem = {
  id: string;
  type: 'layer' | 'node' | 'group';
  title: string;
  level: number; // 0 = root layer, 1 = nodes, 2+ = nested groups
  visible: boolean;
  expanded: boolean;
  locked: boolean;
  children?: TLayerTreeItem[];
  nodeData?: TNodeView; // Reference to actual node data
  layerId: string; // For layer items
};

// Layer tree data - each layer contributes its own tree
export type TLayerTreeData = {
  layerId: string;
  title: string;
  items: TLayerTreeItem[];
};

/**
 * What can be done to a provider's layers, published by the provider itself.
 *
 * The panel draws the stack; it does not know how one is made. Creating a
 * layer on the drawing surface is an Excalidraw event, and a panel that knew
 * that would know one provider by name — so the provider hands over the two
 * verbs and keeps the vocabulary.
 *
 * Absent means the provider has no such thing, and the panel then offers no
 * control for it rather than a dead one.
 */
export type TLayerActions = {
  addLayer?: () => void;
  /** The whole stack, back to front. See the event for why not "move one". */
  reorderLayers?: (layerIds: string[]) => void;
};

// Complete tree data structure for the layer panel
export type TLayerTreeCollection = {
  layers: TLayerTreeData[];
};

// Tree operations
export type TLayerTreeOperation =
  | { type: 'move-node-up'; nodeId: string; layerId: string }
  | { type: 'move-node-down'; nodeId: string; layerId: string }
  | { type: 'toggle-visibility'; nodeId: string; layerId: string }
  | { type: 'toggle-expand'; nodeId: string; layerId: string }
  | { type: 'toggle-lock'; nodeId: string; layerId: string }
  | { type: 'move-to-group'; nodeId: string; groupId: string; layerId: string }
  | { type: 'ungroup'; nodeId: string; layerId: string };

// Tree context for layer panel
export type TLayerTreeContext = {
  treeCollection: TLayerTreeCollection;
  selectedNodeId?: string;
  onTreeOperation: (operation: TLayerTreeOperation) => void;
  onNodeSelect: (nodeId: string) => void;
};

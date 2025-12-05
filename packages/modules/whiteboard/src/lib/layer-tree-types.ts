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

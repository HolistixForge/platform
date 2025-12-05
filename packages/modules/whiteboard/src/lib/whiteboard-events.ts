import { TEventOrigin, TPosition } from '@holistix-forge/core-graph';
import { TEdgeRenderProps } from './components/apis/types/edge';

export type TEventMoveNode = {
  type: 'whiteboard:move-node';
  viewId: string;
  nid: string;
  position: TPosition;
  stop?: boolean;
};

export type TEventReduceNode = {
  type: 'whiteboard:reduce-node';
  viewId: string;
  nid: string;
};

export type TEventExpandNode = {
  type: 'whiteboard:expand-node';
  viewId: string;
  nid: string;
};

export type TEventCloseConnector = {
  type: 'whiteboard:close-connector';
  viewId: string;
  nid: string;
  connectorName: string;
};

export type TEventOpenConnector = {
  type: 'whiteboard:open-connector';
  viewId: string;
  nid: string;
  connectorName: string;
};

export type TEventHighlightFromConnector = {
  type: 'whiteboard:highlight';
  viewId: string;
  nid: string;
  connectorName: string;
  pinName?: string;
};

export type TEventUnhighlightFromConnector = {
  type: 'whiteboard:unhighlight';
  viewId: string;
  nid: string;
  connectorName: string;
  pinName?: string;
};

//

export type TEventFilterOutNode = {
  type: 'whiteboard:filter-out-node';
  viewId: string;
  nid: string;
};

export type TEventUnfilterOutNode = {
  type: 'whiteboard:unfilter-out-node';
  viewId: string;
  nid: string;
  position?: TPosition;
};

export type TEventOpenNode = {
  type: 'whiteboard:open-node';
  viewId: string;
  nid: string;
};

export type TEventCloseNode = {
  type: 'whiteboard:close-node';
  viewId: string;
  nid: string;
};

export type TEventPopNode = {
  type: 'whiteboard:pop-node';
  viewId: string;
  nid: string;
};

export type TEventResizeNode = {
  type: 'whiteboard:resize-node';
  viewId: string;
  nid: string;
  size: { width: number; height: number };
};

export type TEventUpdateGraphView = {
  type: 'whiteboard:update-graph-view';
  viewId: string;
};

export type TEventNewView = {
  type: 'whiteboard:new-view';
  viewId: string;
};

export type TEventNewGroup = {
  type: 'whiteboard:new-group';
  origin?: TEventOrigin;
  groupId: string;
  title: string;
};

export type TEventGroupPropertyChange = {
  type: 'whiteboard:group-property-change';
  groupId: string;
  properties: {
    title?: string;
    borderColor?: string;
    fillColor?: string;
    fillOpacity?: number;
    svgBackground?: string;
  };
};

// Shape types available
export const SHAPE_TYPES = {
  CIRCLE: 'circle',
  DIAMOND: 'diamond',
  HEXAGON: 'hexagon',
  SQUARE: 'square',
  PLUS: 'plus',
  PARALLELOGRAM: 'parallelogram',
  CYLINDER: 'cylinder',
  ARROW_RECTANGLE: 'arrow-rectangle',
  ROUND_RECTANGLE: 'round-rectangle',
  TRIANGLE: 'triangle',
} as const;

export type TShapeType = (typeof SHAPE_TYPES)[keyof typeof SHAPE_TYPES];

// Event type for shape property changes
export type TEventShapePropertyChange = {
  type: 'whiteboard:shape-property-change';
  shapeId: string;
  properties: {
    shapeType?: TShapeType;
    borderColor?: string;
    fillColor?: string;
    fillOpacity?: number;
  };
};

export type TEventNewShape = {
  type: 'whiteboard:new-shape';
  origin?: TEventOrigin;
  shapeId: string;
  shapeType: TShapeType;
};

export type TEventDeleteShape = {
  type: 'whiteboard:delete-shape';
  shapeId: string;
};

export type TEventDeleteGroup = {
  type: 'whiteboard:delete-group';
  groupId: string;
};

export type TEventEdgePropertyChange = {
  type: 'whiteboard:edge-property-change';
  edgeId: string;
  properties: {
    renderProps?: TEdgeRenderProps;
  };
};

export type TEventMoveNodeToFront = {
  type: 'whiteboard:move-node-to-front';
  viewId: string;
  nid: string;
};

export type TEventMoveNodeToBack = {
  type: 'whiteboard:move-node-to-back';
  viewId: string;
  nid: string;
};

export type TEventLockNode = {
  type: 'whiteboard:lock-node';
  viewId: string;
  nid: string;
};

export type TEventDisableFeature = {
  type: 'whiteboard:disable-feature';
  viewId: string;
  nid: string;
  feature: string;
};

export type TWhiteboardEvent =
  | TEventNewView
  | TEventMoveNode
  | TEventReduceNode
  | TEventExpandNode
  | TEventCloseConnector
  | TEventOpenConnector
  | TEventHighlightFromConnector
  | TEventUnhighlightFromConnector
  | TEventResizeNode
  | TEventPopNode
  | TEventUpdateGraphView
  | TEventFilterOutNode
  | TEventUnfilterOutNode
  | TEventOpenNode
  | TEventCloseNode
  | TEventNewGroup
  | TEventGroupPropertyChange
  | TEventShapePropertyChange
  | TEventNewShape
  | TEventDeleteShape
  | TEventDeleteGroup
  | TEventEdgePropertyChange
  | TEventMoveNodeToFront
  | TEventMoveNodeToBack
  | TEventLockNode
  | TEventDisableFeature;

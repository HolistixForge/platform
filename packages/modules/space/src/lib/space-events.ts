import { TEventOrigin, TPosition } from '@monorepo/core';

export type TEventMoveNode = {
  type: 'space:move-node';
  viewId: string;
  nid: string;
  position: TPosition;
  stop?: boolean;
};

export type TEventReduceNode = {
  type: 'space:reduce-node';
  viewId: string;
  nid: string;
};

export type TEventExpandNode = {
  type: 'space:expand-node';
  viewId: string;
  nid: string;
};

export type TEventCloseConnector = {
  type: 'space:close-connector';
  viewId: string;
  nid: string;
  connectorName: string;
};

export type TEventOpenConnector = {
  type: 'space:open-connector';
  viewId: string;
  nid: string;
  connectorName: string;
};

export type TEventHighlightFromConnector = {
  type: 'space:highlight';
  viewId: string;
  nid: string;
  connectorName: string;
  pinName?: string;
};

export type TEventUnhighlightFromConnector = {
  type: 'space:unhighlight';
  viewId: string;
  nid: string;
  connectorName: string;
  pinName?: string;
};

//

export type TEventFilterOutNode = {
  type: 'space:filter-out-node';
  viewId: string;
  nid: string;
};

export type TEventUnfilterOutNode = {
  type: 'space:unfilter-out-node';
  viewId: string;
  nid: string;
  position?: TPosition;
};

export type TEventOpenNode = {
  type: 'space:open-node';
  viewId: string;
  nid: string;
};

export type TEventCloseNode = {
  type: 'space:close-node';
  viewId: string;
  nid: string;
};

export type TEventPopNode = {
  type: 'space:pop-node';
  viewId: string;
  nid: string;
};

export type TEventResizeNode = {
  type: 'space:resize-node';
  viewId: string;
  nid: string;
  size: { width: number; height: number };
};

export type TEventUpdateGraphView = {
  type: 'space:update-graph-view';
  viewId: string;
};

export type TEventNewView = {
  type: 'space:new-view';
  viewId: string;
};

export type TEventNewGroup = {
  type: 'space:new-group';
  origin?: TEventOrigin;
  groupId: string;
  title: string;
};

export type TEventGroupPropertyChange = {
  type: 'space:group-property-change';
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
  type: 'space:shape-property-change';
  shapeId: string;
  properties: {
    shapeType?: TShapeType;
    borderColor?: string;
    fillColor?: string;
    fillOpacity?: number;
  };
};

export type TEventNewShape = {
  type: 'space:new-shape';
  origin?: TEventOrigin;
  shapeId: string;
  shapeType: TShapeType;
};

export type TEventDeleteShape = {
  type: 'space:delete-shape';
  shapeId: string;
};

export type TEventDeleteGroup = {
  type: 'space:delete-group';
  groupId: string;
};

export type TSpaceEvent =
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
  | TEventDeleteGroup;

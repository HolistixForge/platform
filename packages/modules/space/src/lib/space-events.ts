import { TEventOrigin, TPosition } from '@monorepo/core';

export type TSAMoveNode = {
  type: 'move-node';
  nid: string;
  position: TPosition;
  stop?: boolean;
};

export type TSAReduceNode = {
  type: 'reduce-node';
  nid: string;
};

export type TSAExpandNode = {
  type: 'expand-node';
  nid: string;
};

export type TSACloseConnector = {
  type: 'close-connector';
  nid: string;
  connectorName: string;
};

export type TSAOpenConnector = {
  type: 'open-connector';
  nid: string;
  connectorName: string;
};

export type TSAHighlightFromConnector = {
  type: 'highlight';
  nid: string;
  connectorName: string;
  pinName?: string;
};

export type TSAUnhighlightFromConnector = {
  type: 'unhighlight';
  nid: string;
  connectorName: string;
  pinName?: string;
};

//

export type TSAFilterOutNode = {
  type: 'filter-out-node';
  nid: string;
};

export type TSAUnfilterOutNode = {
  type: 'unfilter-out-node';
  nid: string;
  position?: TPosition;
};

export type TSAOpenNode = {
  type: 'open-node';
  nid: string;
};

export type TSACloseNode = {
  type: 'close-node';
  nid: string;
};

export type TSAPopNode = {
  type: 'pop-node';
  nid: string;
};

export type TSAResizeNode = {
  type: 'resize-node';
  nid: string;
  size: { width: number; height: number };
};

export type TSAUpdateGraphView = {
  type: 'update-graph-view';
};

export type TSpaceActions =
  | TSAOpenNode
  | TSACloseNode
  | TSAMoveNode
  | TSAExpandNode
  | TSAReduceNode
  | TSACloseConnector
  | TSAOpenConnector
  | TSAHighlightFromConnector
  | TSAUnhighlightFromConnector
  | TSAResizeNode
  | TSAPopNode
  | TSAUpdateGraphView
  | TSAFilterOutNode
  | TSAUnfilterOutNode;

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

export type TEventSpaceAction = {
  type: 'space:action';
  viewId: string;
  action: TSpaceActions;
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
  | TEventSpaceAction
  | TEventNewGroup
  | TEventGroupPropertyChange
  | TEventShapePropertyChange
  | TEventNewShape
  | TEventDeleteShape
  | TEventDeleteGroup;

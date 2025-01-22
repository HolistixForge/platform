import { TPosition } from './node';

export type TSAMoveNode = {
  type: 'move-node';
  nid: string;
  position: TPosition;
};

export type TSAOpenNode = {
  type: 'open-node';
  nid: string;
};

export type TSACloseNode = {
  type: 'close-node';
  nid: string;
};

export type TSAReduceNode = {
  type: 'reduce-node';
  nid: string;
};

export type TSAExpandNode = {
  type: 'expand-node';
  nid: string;
};

export type TSASelectionChange = {
  type: 'selection-change';
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
};

export type TSAUnhighlightFromConnector = {
  type: 'unhighlight';
  nid: string;
  connectorName: string;
};

export type TSAResizeNode = {
  type: 'resize-node';
  nid: string;
};

export type TSpaceActions =
  | TSAOpenNode
  | TSACloseNode
  | TSAMoveNode
  | TSASelectionChange
  | TSAExpandNode
  | TSAReduceNode
  | TSACloseConnector
  | TSAOpenConnector
  | TSAHighlightFromConnector
  | TSAUnhighlightFromConnector
  | TSAResizeNode;

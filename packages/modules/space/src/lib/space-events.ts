import { TPosition } from '@monorepo/core';

export type TSAMoveNode = {
  type: 'move-node';
  nid: string;
  position: TPosition;
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
  | TSAUpdateGraphView;

export type TEventNewView = {
  type: 'space:new-view';
  viewId: string;
};

export type TSpaceEvent =
  | TEventNewView
  | {
      type: 'space:action';
      viewId: string;
      action: TSpaceActions;
    };

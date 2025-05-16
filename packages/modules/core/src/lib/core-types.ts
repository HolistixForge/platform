import { TJsonObject } from '@monorepo/simple-types';

export type TPosition = {
  x: number;
  y: number;
};

export type TPin = {
  id: string;
  pinName: string;
  disabled?: boolean;
  type?: 'in' | 'out' | 'inout';
};

export type TConnector = {
  connectorName: string;
  disabled?: boolean;
  pins: TPin[];
};

export type TGraphNode = {
  id: string;
  name: string;
  type: string;
  root: boolean;
  data?: TJsonObject;
  connectors: TConnector[];
};

export type EEdgeSemanticType =
  | '_unknown_'
  | 'grouped_edges'
  | 'referenced_by'
  | 'next_in_sequence'
  | 'owned_by'
  | 'composed_of'
  | 'satisfied_by'
  | 'tested_by'
  | 'wired_to'
  | 'depends_on'
  //
  | 'easy-connect';

//

export type TEdgeEnd = {
  node: string;
  connectorName: string;
  pinName?: string;
  data?: TJsonObject;
};

export type TEdge = {
  from: TEdgeEnd;
  to: TEdgeEnd;
  semanticType: EEdgeSemanticType;
  group?: { edges: TEdge[] };
  highlighted?: boolean;
};

export type TProjectMeta = {
  projectActivity: {
    last_activity: string;
    gateway_shutdown: string;
  };
};

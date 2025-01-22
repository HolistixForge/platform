// ----- Edge

type EEdgeType =
  | '_unknown_'
  | 'grouped_edges'
  | 'referenced_by'
  | 'next_in_sequence'
  | 'owned_by'
  | 'composed_of'
  | 'satisfied_by'
  | 'tested_by'
  | 'wired_to'
  | 'depends_on';

//

export type TEdgeEnd = {
  node: string;
  connectorName: string;
  pinName?: string;
};

export type TEdge = {
  from: TEdgeEnd;
  to: TEdgeEnd;
  type: EEdgeType;
  group?: { edges: TEdge[] };
  highlighted?: boolean;
};

//

export const pinId = (ee: { connectorName: string; pinName?: string }) =>
  `${ee.connectorName}::${ee.pinName}`;

export const fromPinId = (id: string) => {
  const [connectorName, pinName] = id.split('::');
  return {
    connectorName,
    pinName,
  };
};

//

export const edgeId = (e: TEdge) => {
  const serializeEdgeEnd = (ee: TEdgeEnd) =>
    `[${ee.node} # ${ee.connectorName || 'default'} # ${ee.pinName}]`;

  const id = `${serializeEdgeEnd(e.from)} -> ${serializeEdgeEnd(e.to)}`;

  if (e.group) return `group ${id}`;
  else return `simple ${id}`;
};

//

export type EdgePayload = {
  type: 'simple' | 'group';
  id: string;
  edge: TEdge;
};

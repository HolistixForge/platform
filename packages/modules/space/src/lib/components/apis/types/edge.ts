import { TEdge, TEdgeEnd } from '@monorepo/core';

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
  text?: string;
  style?: 'straight' | 'default';
  endText?: string;
  startText?: string;
};

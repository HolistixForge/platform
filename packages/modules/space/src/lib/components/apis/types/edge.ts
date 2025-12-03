import { TEdge, TEdgeEnd } from '@holistix/core-graph';
import { EdgeMarker } from '@xyflow/react';

export const pinId = (ee: { connectorName: string; pinName?: string }) =>
  ee.pinName ? `${ee.connectorName}::${ee.pinName}` : ee.connectorName;

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

export type EdgeShape = 'straight' | 'bezier' | 'square';

export type ReactflowEdgePayload = {
  id: string;
  edge: TEdge & {
    renderProps?: TEdgeRenderProps;
  };
  text?: string;
  endText?: string;
  startText?: string;
};

export type TEdgeRenderProps = {
  edgeShape?: EdgeShape;
  markerStart?: EdgeMarker;
  markerEnd?: EdgeMarker;
  /**
   * stroke
   * stroke-width
   * stroke-dasharray
   */
  style?: { [key: string]: string };
  className?: string[];
};

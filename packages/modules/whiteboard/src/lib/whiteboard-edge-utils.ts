import { TEdge, TEdgeEnd } from '@holistix-forge/core-graph';

/**
 * Pure utility functions for edge/pin ID generation
 * These are used by both backend (reducer) and frontend (components)
 * without any React dependencies
 */

export const pinId = (ee: { connectorName: string; pinName?: string }) =>
  ee.pinName ? `${ee.connectorName}::${ee.pinName}` : ee.connectorName;

export const fromPinId = (id: string) => {
  const [connectorName, pinName] = id.split('::');
  return {
    connectorName,
    pinName,
  };
};

export const edgeId = (e: TEdge) => {
  const serializeEdgeEnd = (ee: TEdgeEnd) =>
    `[${ee.node} # ${ee.connectorName || 'default'} # ${ee.pinName}]`;

  const id = `${serializeEdgeEnd(e.from)} -> ${serializeEdgeEnd(e.to)}`;

  if (e.group) return `group ${id}`;
  else return `simple ${id}`;
};

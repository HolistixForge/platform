import { TEdge } from '@holistix-forge/core-graph';
import { EdgeMarker } from '@xyflow/react';

// Re-export pure utilities from backend-safe location
export { pinId, fromPinId, edgeId } from '../../../whiteboard-edge-utils';

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

import { EdgeProps, useInternalNode } from '@xyflow/react';
import { EdgeShape } from '../../../apis/types/edge';
import { getFloatingEdgeParams } from './edge-utils';
import { calculateEdgePath } from './edge-path-utils';

export function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty } = getFloatingEdgeParams(sourceNode, targetNode);
  const edgeShape = (data as any)?.edge?.data?.edgeShape as EdgeShape;

  const [edgePath] = calculateEdgePath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    edgeShape,
  });

  return (
    <path
      id={id}
      className={`react-flow__edge-path floating-edge`}
      d={edgePath}
      markerEnd={markerEnd}
      style={style}
    />
  );
}

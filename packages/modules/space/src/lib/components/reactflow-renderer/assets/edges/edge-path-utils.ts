import {
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
} from '@xyflow/react';
import { EdgeShape } from '../../../apis/types/edge';

type EdgePathParams = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: any;
  targetPosition?: any;
  edgeShape?: EdgeShape;
};

export function calculateEdgePath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  edgeShape = 'bezier',
}: EdgePathParams): [string, number, number] {
  let result;
  switch (edgeShape) {
    case 'straight':
      result = getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
      });
      break;
    case 'square':
      result = getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      });
      break;
    case 'bezier':
    default:
      result = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
  }
  return [result[0], result[1], result[2]];
}

import {
  Children,
  FC,
  ReactNode,
  isValidElement,
  useState,
  useCallback,
  useEffect,
} from 'react';
import {
  EdgeLabelRenderer,
  EdgeProps,
  useInternalNode,
  useViewport,
} from '@xyflow/react';

import { TEdge } from '@holistix/core-graph';

import { ReactflowEdgePayload, TEdgeRenderProps } from '../../apis/types/edge';
import { calculateEdgePath } from './edge-path-utils';
import { getFloatingEdgeParams } from './edge-utils';
import { useSpaceContext } from '../../reactflow-layer-context';

//

type LabelProps = {
  children: ReactNode;
  className?: string;
};

export const LabelStart = ({ children, className }: LabelProps) => {
  return (
    <div className={`edge-label edge-label-start ${className || ''}`}>
      {children}
    </div>
  );
};

export const LabelEnd = ({ children, className }: LabelProps) => {
  return (
    <div className={`edge-label edge-label-end ${className || ''}`}>
      {children}
    </div>
  );
};

export const LabelMiddle = ({ children, className }: LabelProps) => {
  return (
    <div className={`edge-label edge-label-middle ${className || ''}`}>
      {children}
    </div>
  );
};

//
//
//

type Labels = {
  children?: ReactNode;
};

export const EdgeComponent: FC<EdgeProps & Labels> = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  markerStart,
  children,
  data,
}) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const viewport = useViewport();

  const { setEdgeMenu, edgeMenu } = useSpaceContext();

  const handleSetEdgeMenu = useCallback(() => {
    const v = {
      edgeId: id,
      x: ((sourceX + targetX) / 2) * viewport.zoom + viewport.x,
      y: ((sourceY + targetY) / 2) * viewport.zoom + viewport.y,
    };
    if (edgeMenu?.edgeId !== id || edgeMenu?.x !== v.x || edgeMenu?.y !== v.y) {
      setEdgeMenu(v);
    }
  }, [edgeMenu, setEdgeMenu, id, sourceX, targetX, sourceY, targetY, viewport]);

  useEffect(() => {
    if (edgeMenu && edgeMenu.edgeId === id) {
      handleSetEdgeMenu();
    }
  }, [edgeMenu, handleSetEdgeMenu]);

  //

  const payload: ReactflowEdgePayload = data as ReactflowEdgePayload;

  const demiurgeEdge: TEdge & {
    renderProps?: TEdgeRenderProps;
  } = payload?.edge;

  const semanticType = demiurgeEdge.semanticType;

  const {
    edgeShape = 'bezier',
    style,
    className,
  } = demiurgeEdge.renderProps || {};

  let calculatedPath: ReturnType<typeof calculateEdgePath>;

  const isEasyConnect = semanticType === 'easy-connect';

  if (isEasyConnect && sourceNode && targetNode) {
    const { sx, sy, tx, ty } = getFloatingEdgeParams(sourceNode, targetNode);
    calculatedPath = calculateEdgePath({
      sourceX: sx,
      sourceY: sy,
      targetX: tx,
      targetY: ty,
      edgeShape,
    });
  } else
    calculatedPath = calculateEdgePath({
      sourceX: sourceX,
      sourceY: sourceY,
      targetX: targetX,
      targetY: targetY,
      sourcePosition,
      targetPosition,
      edgeShape,
    });

  const [path, labelX, labelY] = calculatedPath;

  // Labels

  const _children = Children.toArray(children);

  const LR = (sourceX < targetX ? 1 : -1) * 40;
  // edge target label position
  const etlx = targetX - LR;
  const etly = targetY - 20;
  // edge source label position
  const eslx = sourceX + LR;
  const esly = sourceY + 20;

  const fromLabels = _children.filter(
    (child) => isValidElement(child) && (child.type as any) === LabelStart
  );

  const toLabels = _children.filter(
    (child) => isValidElement(child) && (child.type as any) === LabelEnd
  );

  const labels = _children.filter(
    (child) => isValidElement(child) && (child.type as any) === LabelMiddle
  );

  //

  const [hovered, setHovered] = useState(false);

  const allClassNames = [
    'react-flow__edge',
    'demiurge-space-edge',
    demiurgeEdge.semanticType,
    ...(className || []),
  ];

  if (demiurgeEdge.highlighted || hovered) {
    allClassNames.push('highlighted');
  }
  if (demiurgeEdge.group) {
    allClassNames.push('edges-group');
  }

  //

  return (
    <>
      {/* Interaction path for pointer events */}
      <path
        d={path}
        stroke="transparent"
        style={{
          cursor: 'pointer',
          strokeWidth: style?.strokeWidth
            ? `calc(${style?.strokeWidth}px + 15px)`
            : '20px',
        }}
        fill="none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleSetEdgeMenu}
        className="edge-interaction-path"
      />
      {/* Visible path, pointer-events: none so only interaction path handles events */}
      <path
        id={id}
        className={`react-flow__edge-path ${allClassNames?.join(' ')}`}
        d={path}
        style={{ ...style, pointerEvents: 'none' }}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        {fromLabels.length > 0 && (
          <EdgeLabel x={eslx} y={esly}>
            {fromLabels}
          </EdgeLabel>
        )}

        {toLabels.length > 0 && (
          <EdgeLabel x={etlx} y={etly}>
            {toLabels}
          </EdgeLabel>
        )}

        {labels.length > 0 && (
          <EdgeLabel x={labelX} y={labelY}>
            {labels}
          </EdgeLabel>
        )}
      </EdgeLabelRenderer>
    </>
  );
};

//
//
//

type EdgeLabelProps = {
  x: number;
  y: number;
  children: ReactNode;
};

//

const EdgeLabel = ({ children, x, y }: EdgeLabelProps) => {
  return (
    <div
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
      }}
      className={`nodrag nopan`}
    >
      {children}
    </div>
  );
};

import { Children, FC, ReactNode, isValidElement } from 'react';
import {
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  getStraightPath,
} from 'reactflow';

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

type AnyLabel =
  | ReturnType<typeof LabelStart>
  | ReturnType<typeof LabelEnd>
  | ReturnType<typeof LabelMiddle>;

type Labels = {
  children?: AnyLabel | AnyLabel[];
};

export const EdgeComponent: FC<
  EdgeProps & Labels & { type?: 'straight' | 'default' }
> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  children,
  type = 'default',
}) => {
  let path: string;
  let labelX: number;
  let labelY: number;

  if (type === 'default') {
    const b = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    [path, labelX, labelY] = b;
  } else if (type === 'straight') {
    const s = getStraightPath({
      sourceX: sourceX,
      sourceY: sourceY,
      targetX,
      targetY,
    });
    [path, labelX, labelY] = s;
  } else throw new Error('oops');

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

  return (
    <>
      <path id={id} className="react-flow__edge-path" d={path} />
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

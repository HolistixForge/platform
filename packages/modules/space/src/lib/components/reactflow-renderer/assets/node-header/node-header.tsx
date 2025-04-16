import { NodeToolbar } from '@xyflow/react';
import { ReactNode } from 'react';

import { NodeMainToolbar, NodeMainToolbarProps } from './node-main-toolbar';
import { TNodeContext } from '../../../apis/types/node';

import './node-header.scss';

type NodeHeaderProps = {
  nodeType: string;
  visible: boolean;
  children?: ReactNode;
} & Pick<TNodeContext, 'id' | 'isOpened' | 'open'> &
  NodeMainToolbarProps;

//
//

export const NodeHeader = ({
  buttons,
  nodeType,
  id,
  isOpened,
  open,
  visible,
  children,
}: NodeHeaderProps) => {
  return (
    <NodeToolbar isVisible={visible} offset={30}>
      <div className="node-wrapper-header node-background">
        <div className="header-row-1">
          <div className="header-left">
            <span className={`node-type node-type-${nodeType}`}>
              {nodeType}
            </span>
          </div>
          <span
            className="node-id ellipsis"
            onClick={!isOpened ? open : undefined}
          >
            {id.length > 25 ? id.slice(0, 25) + '...' : id}
          </span>
          <NodeMainToolbar buttons={buttons} />
        </div>

        {children && Array.isArray(children) ? (
          children.map((child, index) => (
            <div key={index} className={`header-row header-row-${index + 2}`}>
              {child}
            </div>
          ))
        ) : children ? (
          <div className="header-row header-row-2">{children}</div>
        ) : null}
      </div>
    </NodeToolbar>
  );
};

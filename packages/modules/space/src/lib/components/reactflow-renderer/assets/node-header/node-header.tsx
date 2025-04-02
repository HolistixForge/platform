import { NodeToolbar } from 'reactflow';

import { NodeMainToolbar, NodeMainToolbarProps } from './node-main-toolbar';
import { TNodeContext } from '../../../apis/types/node';

import './node-header.scss';

type NodeHeaderProps = {
  nodeType: string;
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
}: NodeHeaderProps) => {
  return (
    <NodeToolbar>
      <div className="header-row-1">
        <div className="header-left">
          <span className={`node-type node-type-${nodeType}`}>{nodeType}</span>
        </div>
        <span
          className="node-id ellipsis"
          onClick={!isOpened ? open : undefined}
        >
          Node [{id}]
        </span>
        <NodeMainToolbar buttons={buttons} />
      </div>
    </NodeToolbar>
  );
};

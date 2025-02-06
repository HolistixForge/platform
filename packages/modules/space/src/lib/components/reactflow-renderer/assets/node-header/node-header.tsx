import { NodeToolbar, NodeToolbarProps } from './node-toolbar';
import { TNodeContext } from '../../../apis/types/node';

import './node-header.scss';

type NodeHeaderProps = {
  nodeType: string;
} & Pick<TNodeContext, 'id' | 'isOpened' | 'open'> &
  NodeToolbarProps;

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
    <div className="node-wrapper-header node-background">
      <div className="header-row-1">
        <div className="header-left">
          <span className={`node-type node-type-${nodeType}`}>{nodeType}</span>
        </div>
        <NodeToolbar buttons={buttons} />
      </div>

      <div className="header-row-2">
        <span className="node-id" onClick={!isOpened ? open : undefined}>
          Node [{id}]
        </span>
      </div>
    </div>
  );
};

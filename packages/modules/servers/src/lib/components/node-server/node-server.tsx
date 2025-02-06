import { CSSProperties } from 'react';

import {
  NodeHeader,
  DisablePanSelect,
  TNodeContext,
  useMakeButton,
} from '@monorepo/space';

import { ServerCard } from '../server-card';
import {
  TServerComponentProps,
  TServerComponentCallbacks,
} from '../../servers-types';

/**
 *
 */

export const NodeServer = (
  props: TServerComponentProps &
    TServerComponentCallbacks &
    Pick<
      TNodeContext,
      'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
    >
) => {
  //

  const {
    id,
    isOpened,
    open,
    close,
    viewStatus,
    expand,
    reduce,
    onDelete,
    ...otherProps
  } = props;

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    onDelete,
    isOpened,
    open,
    close,
  });

  return (
    <div
      className={`common-node server-node`}
      style={{ '--node-wrapper-header-height': '78px' } as CSSProperties}
    >
      {/* <InputsAndOutputs id={id} /> */}
      <NodeHeader
        nodeType="server"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
      />
      {isOpened && (
        <DisablePanSelect>
          <div className="node-wrapper-body server">
            <ServerCard {...otherProps} onDelete={onDelete} />
          </div>
        </DisablePanSelect>
      )}
    </div>
  );
};

import { NodeHeader } from '../node-common/node-header';
import { DisablePanSelect } from '../../demiurge-space-2';
import { useMakeButton } from '../node-common/node-toolbar';
import { ServerCard } from '../../mvp-ui-view/components/server-card';
import { CSSProperties } from 'react';
import {
  TServerComponentProps,
  TServerComponentCallbacks,
  TUseNodeValue,
} from '@monorepo/demiurge-types';

/**
 *
 */

export const NodeServer = (
  props: TServerComponentProps &
    TServerComponentCallbacks &
    Pick<
      TUseNodeValue,
      'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
    >,
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

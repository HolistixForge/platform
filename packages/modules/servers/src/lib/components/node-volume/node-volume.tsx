import { useCallback } from 'react';

import {
  InputsAndOutputs,
  TNodeContext,
  NodeHeader,
  DisableZoomDragPan,
  useMakeButton,
  useNodeContext,
} from '@monorepo/space';
import { TGraphNode } from '@monorepo/core';
import { useDispatcher } from '@monorepo/collab-engine';

import { TEventDeleteVolume } from '../../servers-events';

//

export type NodeVolumeInternalProps = {
  volume_name: string;
  volume_storage: number;
  onDelete: () => Promise<void>;
} & Pick<
  TNodeContext,
  | 'id'
  | 'isOpened'
  | 'open'
  | 'close'
  | 'viewStatus'
  | 'expand'
  | 'reduce'
  | 'selected'
>;

//

export const NodeVolumeInternal = ({
  id,
  open,
  close,
  isOpened,
  volume_name,
  volume_storage,
  onDelete,
  viewStatus,
  expand,
  reduce,
  selected,
}: NodeVolumeInternalProps) => {
  //

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
    <div className={`common-node volume-node`}>
      <InputsAndOutputs id={id} top={false} />
      <NodeHeader
        nodeType="volume"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
        visible={selected}
      />
      {isOpened && (
        <DisableZoomDragPan noDrag>
          <div
            className="node-wrapper-body"
            style={{
              backgroundColor: 'var(--c-black-6)',
              color: 'var(--c-white-1)',
              lineHeight: '30px',
              padding: '15px',
            }}
          >
            <span>
              {volume_name} [{volume_storage} Gi]
            </span>
          </div>
        </DisableZoomDragPan>
      )}
    </div>
  );
};

//

//

export const NodeVolume = ({ node }: { node: TGraphNode }) => {
  const { volume_id, volume_name, volume_storage } = node.data! as {
    volume_id: number;
    volume_name: string;
    volume_storage: number;
  };
  //
  const useNodeValue = useNodeContext();

  const dispatcher = useDispatcher<TEventDeleteVolume>();

  const handleDeleteVolume = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'servers:delete-volume',
      volume_id,
    });
  }, [dispatcher, volume_id]);

  return (
    <NodeVolumeInternal
      {...useNodeValue}
      volume_name={volume_name}
      volume_storage={volume_storage}
      onDelete={handleDeleteVolume}
    />
  );
};

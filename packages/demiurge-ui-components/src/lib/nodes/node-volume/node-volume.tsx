import { InputsAndOutputs } from '../../demiurge-space-2';
import { NodeHeader } from '../node-common/node-header';
import { DisablePanSelect } from '../../demiurge-space-2';
import { useMakeButton } from '../node-common/node-toolbar';
import { TUseNodeValue } from '@monorepo/demiurge-types';

export type NodeVolumeProps = {
  volume_name: string;
  volume_storage: number;
  onDelete: () => Promise<void>;
} & Pick<
  TUseNodeValue,
  'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
>;

//

export const NodeVolume = ({
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
}: NodeVolumeProps) => {
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
      />
      {isOpened && (
        <DisablePanSelect>
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
        </DisablePanSelect>
      )}
    </div>
  );
};

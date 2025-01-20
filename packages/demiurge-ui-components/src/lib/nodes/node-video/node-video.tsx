import { FC, Suspense } from 'react';
import { DisablePanSelect } from '../../demiurge-space-2';
import { NodeHeader } from '../node-common/node-header';
import { useMakeButton } from '../node-common/node-toolbar';
import { TUseNodeValue } from '@monorepo/demiurge-types';

export type NodeVideoProps = {
  youtubeId: string;
  Youtube: FC<{ data: { videoId: string } }>;
  onDelete: () => Promise<void>;
} & Pick<
  TUseNodeValue,
  'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
>;

export const NodeVideo = ({
  id,
  isOpened,
  open,
  close,
  youtubeId,
  Youtube,
  onDelete,
  viewStatus,
  expand,
  reduce,
}: NodeVideoProps) => {
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
    <div className={`common-node video-node`}>
      <NodeHeader
        nodeType="video"
        id={id}
        open={open}
        isOpened={false}
        buttons={buttons}
      />
      {isOpened && (
        <DisablePanSelect>
          <div className="node-wrapper-body video">
            <Suspense fallback={<span> Loading Component... </span>}>
              <Youtube data={{ videoId: youtubeId }} />
            </Suspense>
          </div>
        </DisablePanSelect>
      )}
    </div>
  );
};

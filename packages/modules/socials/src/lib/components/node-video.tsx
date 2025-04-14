import { FC, Suspense, useCallback } from 'react';

import { TGraphNode } from '@monorepo/core';
import { useNodeContext } from '@monorepo/space';
import { useFactory } from '@monorepo/lazy-factory';
import { useDispatcher } from '@monorepo/collab-engine';
import {
  DisableZoomDragPan,
  TNodeContext,
  NodeHeader,
  useMakeButton,
} from '@monorepo/space';

import factory from '@monorepo/lazy-factory';

import { TEventSocials } from '../socials-events';

import './node-video.scss';

// TODO: compile error if import path is not calculated,
// does it still lazy load ?
factory.setLibraries({
  socials: () => import(`@monorepo/${'social-embeds'}`).then((l) => l.default),
});

//

export type NodeYoutubeInternalProps = {
  youtubeId: string;
  Youtube: FC<{ data: { videoId: string } }>;
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

export const NodeYoutubeInternal = ({
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
  selected,
}: NodeYoutubeInternalProps) => {
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
    <div className={`common-node video-node full-height node-resizable`}>
      <NodeHeader
        nodeType="video"
        id={id}
        open={open}
        isOpened={false}
        buttons={buttons}
        visible={selected}
      />
      {isOpened && (
        <DisableZoomDragPan fullHeight noDrag>
          <div className="node-wrapper-body full-height video">
            <Suspense fallback={<span> Loading Component... </span>}>
              <Youtube data={{ videoId: youtubeId }} />
            </Suspense>
            <div className="select-handle">Select</div>
          </div>
        </DisableZoomDragPan>
      )}
    </div>
  );
};

//

export const NodeYoutube = ({ node }: { node: TGraphNode }) => {
  const videoId = node.data!.videoId as string;

  const useNodeValue = useNodeContext();

  const { id } = useNodeValue;

  const { Component: Youtube } = useFactory('socials:youtube', ['DOM'], null);

  const dispatcher = useDispatcher<TEventSocials>();

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'socials:delete-youtube',
      nodeId: id,
    });
  }, [dispatcher, id]);

  //

  return (
    <NodeYoutubeInternal
      youtubeId={videoId}
      Youtube={Youtube}
      {...useNodeValue}
      onDelete={handleDelete}
    />
  );
};

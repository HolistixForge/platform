import { FC, Suspense, useCallback } from 'react';

import { TEventDeleteNode, TGraphNode } from '@monorepo/core';
import { useNodeContext } from '@monorepo/space';
import { useFactory } from '@monorepo/lazy-factory';
import { useDispatcher } from '@monorepo/collab-engine';
import {
  DisablePanSelect,
  TNodeContext,
  NodeHeader,
  useMakeButton,
} from '@monorepo/space';

import factory from '@monorepo/lazy-factory';

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
  'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
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

//

export const NodeYoutube = ({ node }: { node: TGraphNode }) => {
  const videoId = node.data!.videoId as string;

  const useNodeValue = useNodeContext();

  const { id } = useNodeValue;

  const { Component: Youtube } = useFactory('socials:youtube', ['DOM'], null);

  const dispatcher = useDispatcher<TEventDeleteNode>();

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'core:delete-node',
      id,
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

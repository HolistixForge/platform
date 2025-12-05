import { FC, Suspense, useCallback } from 'react';

import { TGraphNode } from '@holistix-forge/core-graph';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import {
  DisableZoomDragPan,
  TNodeContext,
  NodeHeader,
  useNodeHeaderButtons,
  useNodeContext,
} from '@holistix-forge/whiteboard/frontend';

import { TEventSocials } from '../socials-events';

import './node-video.scss';

//

export type NodeYoutubeInternalProps = {
  youtubeId: string;
  Youtube: FC<{ data: { videoId: string } }>;
  onDelete: () => Promise<void>;
} & Pick<TNodeContext, 'id' | 'isOpened' | 'open' | 'selected'>;

//

export const NodeYoutubeInternal = ({
  id,
  isOpened,
  open,
  youtubeId,
  Youtube,
  onDelete,
  selected,
}: NodeYoutubeInternalProps) => {
  //

  const buttons = useNodeHeaderButtons({
    onDelete,
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
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const videoId = node.data!.videoId as string;

  const useNodeValue = useNodeContext();

  const { id } = useNodeValue;

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

interface I_YoutubeProps {
  data: {
    videoId: string;
  };
}

export const Youtube = ({ data }: I_YoutubeProps) => {
  const { videoId } = data;

  const src = `https://www.youtube.com/embed/${videoId}`;

  return (
    <div style={{ height: '100%' }}>
      <iframe
        style={{ width: '100%', height: '100%' }}
        src={src}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
};

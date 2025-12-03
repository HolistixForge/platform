import { Suspense, useCallback, memo } from 'react';

import { TGraphNode } from '@holistix/core-graph';
import { useDispatcher } from '@holistix/reducers/frontend';
import {
  DisableZoomDragPan,
  TNodeContext,
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@holistix/space/frontend';

import { TEventSocials } from '../socials-events';

import './node-iframe.scss';

export type NodeIframeInternalProps = {
  src: string;
  onDelete: () => Promise<void>;
} & Pick<TNodeContext, 'id' | 'isOpened' | 'open' | 'selected'>;

export const NodeIframeInternal = ({
  id,
  isOpened,
  open,
  src,
  onDelete,
  selected,
}: NodeIframeInternalProps) => {
  //

  const buttons = useNodeHeaderButtons({
    onDelete,
  });

  return (
    <div className={`common-node iframe-node full-height node-resizable`}>
      <NodeHeader
        nodeType="iframe"
        id={id}
        open={open}
        isOpened={false}
        buttons={buttons}
        visible={selected}
      />
      {isOpened && (
        <DisableZoomDragPan fullHeight noDrag>
          <div className="node-wrapper-body full-height iframe">
            <Suspense fallback={<span>Loading iframe...</span>}>
              <MemoizedIframe src={src} />
            </Suspense>
            <div className="select-handle">Select</div>
          </div>
        </DisableZoomDragPan>
      )}
    </div>
  );
};

const MemoizedIframe = memo(
  ({ src }: { src: string }) => (
    <iframe
      src={src}
      loading="lazy"
      title="Embedded content"
      className="iframe-content"
      allow="clipboard-write; encrypted-media;"
      allowFullScreen
    />
  ),
  (prevProps, nextProps) => prevProps.src === nextProps.src
);

export const NodeIframe = ({ node }: { node: TGraphNode }) => {
  const src = node.data!.src as string;

  const useNodeValue = useNodeContext();
  const { id } = useNodeValue;
  const dispatcher = useDispatcher<TEventSocials>();

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'socials:delete-iframe',
      nodeId: id,
    });
  }, [dispatcher, id]);

  return (
    <NodeIframeInternal src={src} {...useNodeValue} onDelete={handleDelete} />
  );
};

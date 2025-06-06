import { Suspense, useCallback, memo } from 'react';

import { TGraphNode } from '@monorepo/module';
import { useDispatcher } from '@monorepo/collab-engine';
import {
  DisableZoomDragPan,
  TNodeContext,
  NodeHeader,
  useMakeButton,
  useNodeContext,
} from '@monorepo/space/frontend';

import { TEventSocials } from '../socials-events';

import './node-iframe.scss';

export type NodeIframeInternalProps = {
  src: string;
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
  | 'filterOut'
>;

export const NodeIframeInternal = ({
  id,
  isOpened,
  open,
  close,
  src,
  onDelete,
  viewStatus,
  expand,
  reduce,
  selected,
  filterOut,
}: NodeIframeInternalProps) => {
  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    onDelete,
    isOpened,
    open,
    close,
    filterOut,
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

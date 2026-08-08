import { FC, useCallback, useMemo } from 'react';

import {
  useNodeContext,
  useNodeHeaderButtons,
  useLayerContext,
  NodeHeader,
  InputsAndOutputs,
  DisableZoomDragPan,
} from '@holistix-forge/whiteboard/frontend';
import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import { ButtonBase } from '@holistix-forge/ui-base';
import { TCoreEvent, TGraphNode } from '@holistix-forge/core-graph';

import { TExcalidrawLayerPayload } from './layer';
import { TExcalidrawSharedData } from './excalidraw-shared-model';
import { TExcalidrawEvent } from './excalidraw-events';
import { pickDrawingElements } from './excalidraw-scene';
import { useDrawingSvg } from './use-drawing-svg';

import './excalidraw-node.scss';

//

export const ExcalidrawNode: FC<{ node: TGraphNode<never> }> = ({ node }) => {
  const { id, isOpened, open, selected } = useNodeContext();
  const { activeLayerId, activeLayerPayload, activateLayer } =
    useLayerContext();

  // Reactive, and per element: the preview used to read a whole-drawing entry
  // that carried a serialized SVG, rewritten in Yjs on every keystroke. The
  // SVG is derived here instead — it is a rendering, not shared state.
  const entries = useLocalSharedData<TExcalidrawSharedData>(
    ['excalidraw:elements'],
    (d) => d['excalidraw:elements']
  );

  const elements = useMemo(
    () => pickDrawingElements(entries ?? [], id),
    [entries, id]
  );

  const svg = useDrawingSvg(elements);

  // Check if this node is currently being edited
  const isBeingEdited =
    activeLayerId === 'excalidraw' && activeLayerPayload?.nodeId === id;

  const { viewId } = useNodeContext();

  const handleEdit = useCallback(() => {
    const pl: TExcalidrawLayerPayload = { nodeId: id, viewId: viewId };
    activateLayer('excalidraw', pl);
  }, [activateLayer, id, viewId]);

  const dispatcher = useDispatcher<TCoreEvent | TExcalidrawEvent>();

  const handleDelete = useCallback(async () => {
    // The elements are keyed by drawing, not owned by the node, so deleting
    // the node alone would leave every one of them in the shared map with
    // nothing left to render them.
    await dispatcher.dispatch({
      type: 'excalidraw:delete-drawing',
      drawingId: id,
    });
    await dispatcher.dispatch({
      type: 'core:delete-node',
      id: id,
    });
  }, [dispatcher, id]);

  const buttons = useNodeHeaderButtons({
    onDelete: handleDelete,
  });

  return (
    <div
      className={`node-excalidraw node-resizable full-height ${
        isBeingEdited ? 'is-being-edited' : ''
      }`}
      style={{
        width: '100%',
        height: '100%',
        background: isBeingEdited ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
      }}
    >
      <InputsAndOutputs id={id} invisible />
      <NodeHeader
        nodeType="Excalidraw"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
        visible={selected}
      >
        <ButtonBase callback={handleEdit} text="Edit" tooltip="Edit drawing" />
      </NodeHeader>
      <DisableZoomDragPan fullHeight noDrag>
        <div className="excalidraw-content full-height">
          {svg ? (
            <div
              className="excalidraw-svg-container"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
              }}
              dangerouslySetInnerHTML={{
                __html: isBeingEdited ? '' : svg,
              }}
            />
          ) : (
            <div
              className="excalidraw-placeholder"
              style={{
                cursor: 'pointer',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-bg-surface)',
                border: '2px dashed var(--color-border)',
                borderRadius: '8px',
                color: 'var(--color-text-muted)',
                fontSize: '14px',
              }}
            >
              Empty Drawing
            </div>
          )}
        </div>
      </DisableZoomDragPan>
    </div>
  );
};

import { FC, useCallback } from 'react';
import { TGraphNode } from '@monorepo/module';
import { useNodeContext, useNodeHeaderButtons } from '@monorepo/space/frontend';
import { useLayerContext } from '@monorepo/space/frontend';
import { useDispatcher, useSharedDataDirect } from '@monorepo/collab-engine';
import { NodeHeader } from '@monorepo/space/frontend';
import { InputsAndOutputs } from '@monorepo/space/frontend';
import { DisableZoomDragPan } from '@monorepo/space/frontend';
import { ButtonBase } from '@monorepo/ui-base';
import { TCoreEvent } from '@monorepo/core';

import { TExcalidrawLayerPayload } from './layer';
import { TExcalidrawSharedData } from './excalidraw-shared-model';

import './excalidraw-node.scss';

export const ExcalidrawNode: FC<{ node: TGraphNode }> = ({ node }) => {
  const { id, isOpened, open, selected } = useNodeContext();
  const { activeLayerId, activeLayerPayload, activateLayer } =
    useLayerContext();
  const sharedData = useSharedDataDirect<TExcalidrawSharedData>();

  // Get the drawing data for this node
  const drawing = sharedData.excalidrawDrawing.get(id);

  // Check if this node is currently being edited
  const isBeingEdited =
    activeLayerId === 'excalidraw' && activeLayerPayload?.nodeId === id;

  const { viewId } = useNodeContext();

  const handleEdit = useCallback(() => {
    const pl: TExcalidrawLayerPayload = { nodeId: id, viewId: viewId };
    activateLayer('excalidraw', pl);
  }, [activateLayer, id, viewId]);

  const dispatcher = useDispatcher<TCoreEvent>();

  const handleDelete = useCallback(async () => {
    dispatcher.dispatch({
      type: 'core:delete-node',
      id: id,
    });
  }, [dispatcher, id]);

  const buttons = useNodeHeaderButtons({
    onDelete: handleDelete,
  });

  return (
    <div
      className="node-excalidraw node-resizable full-height"
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
          {drawing?.svg ? (
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
                __html: isBeingEdited ? '' : drawing.svg,
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
                background: 'var(--color-surface)',
                border: '2px dashed var(--color-border)',
                borderRadius: '8px',
                color: 'var(--color-text-secondary)',
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

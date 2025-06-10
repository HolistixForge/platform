import { useCallback, useRef } from 'react';

import { TGraphNode } from '@monorepo/module';
import { useDispatcher } from '@monorepo/collab-engine';
import {
  addAlphaToHexColor,
  ColorPicker,
  ColorValue,
  ButtonBase,
} from '@monorepo/ui-base';

import { NodeHeader } from '../assets/node-header/node-header';
import { useMakeButton } from '../assets/node-header/node-main-toolbar';
import { useNodeContext } from '../node-wrappers/node-wrapper';
import {
  TEventGroupPropertyChange,
  TEventDeleteGroup,
} from '../../space-events';
import { DisableZoomDragPan } from '../node-wrappers/disable-zoom-drag-pan';
import { InputsAndOutputs } from '../assets/inputsOutputs/inputsOutputs';

import './group.scss';

//

export const Group = ({ node }: { node: TGraphNode }) => {
  const {
    id,
    expand,
    reduce,
    isOpened,
    open,
    close,
    viewStatus,
    selected,
    filterOut,
  } = useNodeContext();
  const groupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dispatcher = useDispatcher<
    TEventGroupPropertyChange | TEventDeleteGroup
  >();

  const handleDeleteGroup = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'space:delete-group',
      groupId: id,
    });
  }, [dispatcher, id]);

  const {
    title = 'Group Name',
    borderColor = '#672aa4',
    fillColor = '#672aa4',
    fillOpacity = 0,
    svgBackground,
  } = node.data as {
    title: string;
    borderColor: string;
    fillColor: string;
    fillOpacity: number;
    svgBackground?: string;
  };

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
    onDelete: handleDeleteGroup,
    filterOut,
  });

  const handleBorderColorChange = useCallback((color: ColorValue) => {
    console.log('group color', color);
    dispatcher.dispatch({
      type: 'space:group-property-change',
      groupId: id,
      properties: {
        borderColor: color.hex,
      },
    });
  }, []);

  const handleFillColorChange = useCallback((color: ColorValue) => {
    console.log('group color', color);
    dispatcher.dispatch({
      type: 'space:group-property-change',
      groupId: id,
      properties: {
        fillColor: color.hex,
        fillOpacity: color.opacity,
      },
    });
  }, []);

  const handleTitleBlur = useCallback(
    (event: React.FocusEvent<HTMLHeadingElement>) => {
      const newTitle = event.target.textContent;
      if (newTitle && newTitle !== title) {
        dispatcher.dispatch({
          type: 'space:group-property-change',
          groupId: id,
          properties: {
            title: newTitle,
          },
        });
      }
    },
    [dispatcher, id, title]
  );

  const handleSvgFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const svgContent = e.target?.result as string;
          // Clean up SVG content by removing everything before the <svg tag
          const cleanSvgContent = svgContent.substring(
            svgContent.indexOf('<svg')
          );
          dispatcher.dispatch({
            type: 'space:group-property-change',
            groupId: id,
            properties: {
              svgBackground: cleanSvgContent,
            },
          });
        };
        reader.readAsText(file);
      }
    },
    [dispatcher, id]
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      ref={groupRef}
      className={`node-group full-height node-resizable`}
      style={
        {
          '--group-border-color': borderColor,
          '--group-fill-color': addAlphaToHexColor(
            fillColor,
            fillOpacity / 100
          ),
          '--group-background-svg': svgBackground
            ? `url("data:image/svg+xml,${encodeURIComponent(svgBackground)}")`
            : 'none',
        } as React.CSSProperties
      }
    >
      <InputsAndOutputs id={id} invisible />
      <NodeHeader
        nodeType="Group"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
        visible={selected}
      >
        <div className="group-title-buttons">
          <ColorPicker
            initialColor={borderColor}
            buttonTitle="Border Color"
            onChange={handleBorderColorChange}
          />
          <ColorPicker
            withTransparency
            initialColor={fillColor}
            initialOpacity={fillOpacity}
            buttonTitle="Fill Color"
            onChange={handleFillColorChange}
          />
          <ButtonBase
            callback={handleUploadClick}
            text="Upload SVG"
            tooltip="Upload SVG Background"
            style={{ border: 'none', height: '20px', fontSize: '12px' }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            style={{ display: 'none' }}
            onChange={handleSvgFileSelect}
          />
        </div>
      </NodeHeader>
      <DisableZoomDragPan fullHeight noDrag>
        <div className="group-content full-height">
          <div className="group-title">
            <h2
              contentEditable
              suppressContentEditableWarning
              onBlur={handleTitleBlur}
            >
              {title}
            </h2>
          </div>
          <div className="group-border"></div>
        </div>
      </DisableZoomDragPan>
    </div>
  );
};

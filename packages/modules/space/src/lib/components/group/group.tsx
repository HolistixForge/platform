import { useCallback, useRef } from 'react';

import { TGraphNode } from '@monorepo/core';
import { useDispatcher } from '@monorepo/collab-engine';
import { addAlphaToHexColor, ColorPicker, ColorValue } from '@monorepo/ui-base';

import { NodeHeader } from '../reactflow-renderer/assets/node-header/node-header';
import { useMakeButton } from '../reactflow-renderer/assets/node-header/node-toolbar';
import { useNodeContext } from '../reactflow-renderer/node-wrappers/node-wrapper';
import { TEventGroupPropertyChange } from '../../space-events';

import './group.scss';

//

export const Group = ({ node }: { node: TGraphNode }) => {
  const { id, expand, reduce, isOpened, open, close, viewStatus } =
    useNodeContext();
  const groupRef = useRef<HTMLDivElement>(null);

  const dispatcher = useDispatcher<TEventGroupPropertyChange>();

  const {
    title = 'Group Name',
    borderColor = 'var(--c-pink-51)',
    fillColor = 'transparent',
    fillOpacity = 0,
  } = node.data as {
    title: string;
    borderColor: string;
    fillColor: string;
    fillOpacity: number;
  };

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
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
        } as React.CSSProperties
      }
    >
      <NodeHeader
        nodeType="Group"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
      />
      <div className="group-content full-height-wo-header">
        <div className="group-title">
          <h2
            contentEditable
            suppressContentEditableWarning
            onBlur={handleTitleBlur}
          >
            {title}
          </h2>
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
          </div>
        </div>
        <div className="group-border"></div>
      </div>
    </div>
  );
};

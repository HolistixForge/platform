import { useCallback } from 'react';
import {
  addAlphaToHexColor,
  ColorPicker,
  ColorValue,
  SelectFieldset,
  SelectItem,
} from '@holistix-forge/ui-base';
import { TGraphNode } from '@holistix-forge/core-graph';
import { useDispatcher } from '@holistix-forge/reducers/frontend';

import { NodeHeader } from '../assets/node-header/node-header';
import { useNodeHeaderButtons } from '../assets/node-header/node-main-toolbar';
import { useNodeContext } from '../node-wrappers/node-wrapper';
import { DisableZoomDragPan } from '../node-wrappers/disable-zoom-drag-pan';

import {
  SHAPE_TYPES,
  TShapeType,
  TEventShapePropertyChange,
  TEventDeleteShape,
} from '../../whiteboard-events';

import './shape.scss';

// Component for rendering the SVG shape
const ShapeSvg = ({ type }: { type: TShapeType }) => {
  switch (type) {
    case SHAPE_TYPES.CIRCLE:
      return <circle cx="50" cy="50" r="40" />;
    case SHAPE_TYPES.DIAMOND:
      return <polygon points="50,10 90,50 50,90 10,50" />;
    case SHAPE_TYPES.HEXAGON:
      return <polygon points="50,10 90,30 90,70 50,90 10,70 10,30" />;
    case SHAPE_TYPES.SQUARE:
      return <rect x="10" y="10" width="80" height="80" />;
    case SHAPE_TYPES.PLUS:
      return (
        <path d="M60,20 H40 V40 H20 V60 H40 V80 H60 V60 H80 V40 H60 V20" />
      );
    case SHAPE_TYPES.PARALLELOGRAM:
      return <polygon points="20,80 80,80 90,20 30,20" />;
    case SHAPE_TYPES.CYLINDER:
      return (
        <>
          <ellipse cx="50" cy="25" rx="40" ry="15" />
          <path d="M10,25 V75 Q50,95 90,75 V25" />
          <ellipse cx="50" cy="75" rx="40" ry="15" />
        </>
      );
    case SHAPE_TYPES.ARROW_RECTANGLE:
      return <path d="M10,20 H70 L70,10 L90,40 L70,70 L70,60 H10 Z" />;
    case SHAPE_TYPES.ROUND_RECTANGLE:
      return <rect x="10" y="20" width="80" height="60" rx="15" ry="15" />;
    case SHAPE_TYPES.TRIANGLE:
      return <polygon points="50,10 90,90 10,90" />;
    default:
      return null;
  }
};

// Shape node component
export const Shape = ({ node }: { node: TGraphNode }) => {
  const {
    shapeType = SHAPE_TYPES.CIRCLE,
    borderColor = '#672aa4',
    fillColor = '#672aa4',
    fillOpacity = 0,
  } = node.data as {
    shapeType: TShapeType;
    borderColor: string;
    fillColor: string;
    fillOpacity: number;
  };

  const useNodeValue = useNodeContext();
  const { id, isOpened, open, selected } = useNodeValue;

  const dispatcher = useDispatcher<
    TEventShapePropertyChange | TEventDeleteShape
  >();

  const handleDeleteShape = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'whiteboard:delete-shape',
      shapeId: id,
    });
  }, [dispatcher, id]);

  const buttons = useNodeHeaderButtons({
    onDelete: handleDeleteShape,
  });

  const handleShapeTypeChange = useCallback(
    (newType: TShapeType) => {
      dispatcher.dispatch({
        type: 'whiteboard:shape-property-change',
        shapeId: id,
        properties: {
          shapeType: newType,
        },
      });
    },
    [dispatcher, id]
  );

  const handleBorderColorChange = useCallback(
    (color: ColorValue) => {
      dispatcher.dispatch({
        type: 'whiteboard:shape-property-change',
        shapeId: id,
        properties: {
          borderColor: color.hex,
        },
      });
    },
    [dispatcher, id]
  );

  const handleFillColorChange = useCallback(
    (color: ColorValue) => {
      dispatcher.dispatch({
        type: 'whiteboard:shape-property-change',
        shapeId: id,
        properties: {
          fillColor: color.hex,
          fillOpacity: color.opacity,
        },
      });
    },
    [dispatcher, id]
  );

  const style = {
    '--shape-border-color': borderColor,
    '--shape-fill-color': addAlphaToHexColor(fillColor, fillOpacity / 100),
  } as React.CSSProperties;

  return (
    <div className="node-shape full-height node-resizable" style={style}>
      <NodeHeader
        nodeType="shape"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
        visible={selected}
      >
        <div className="shape-controls">
          <SelectFieldset
            name="shape-type"
            value={shapeType}
            onChange={(value) => handleShapeTypeChange(value as TShapeType)}
            className="small"
            integrated
            placeholder="Select shape"
            style={style}
          >
            {Object.values(SHAPE_TYPES).map((type) => (
              <SelectItem key={type} value={type}>
                <svg
                  className="shape-icon"
                  viewBox="0 0 100 100"
                  width="20"
                  height="20"
                >
                  <ShapeSvg type={type} />
                </svg>
              </SelectItem>
            ))}
          </SelectFieldset>
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
      </NodeHeader>
      <DisableZoomDragPan fullHeight noDrag>
        <div className="shape-content">
          <svg className={`shape ${shapeType}`} viewBox="0 0 100 100">
            <ShapeSvg type={shapeType} />
          </svg>
        </div>
      </DisableZoomDragPan>
    </div>
  );
};

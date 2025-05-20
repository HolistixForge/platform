import { CSSProperties, useCallback } from 'react';

import { ColorPicker } from '@monorepo/ui-base';
import { SelectFieldset, SelectItem, SliderFieldset } from '@monorepo/ui-base';
import { useSharedData } from '@monorepo/collab-engine';
import { TCoreSharedData } from '@monorepo/core';

import { edgeId, TEdgeRenderProps } from '../../../apis/types/edge';

import './edge-menu.scss';

const EDGE_SHAPES = [
  { label: 'Straight', value: 'straight' },
  { label: 'Bezier', value: 'bezier' },
  { label: 'Square', value: 'square' },
];

const DASH_STYLES = [
  { label: 'Solid', value: 'none' },
  { label: 'Dashed', value: '6,4' },
  { label: 'Dotted', value: '2,2' },
  { label: 'Dash-dot', value: '6,2,2,2' },
];

const sliderWidth = '100px';

// MarkerEditor: reusable component for marker start/end
type MarkerEditorProps = {
  label: string;
  markerProps?: {
    color?: string;
    width?: number;
    height?: number;
    strokeWidth?: number;
    type?: string;
  };
  onChange: (field: string, value: any) => void;
  onColorChange: (color: any) => void;
};

const MarkerEditor = ({
  label,
  markerProps,
  onChange,
  onColorChange,
}: MarkerEditorProps) => {
  return (
    <div className="edge-menu-row">
      <span className="edge-menu-label">{label}</span>
      <SelectFieldset
        name={`${label.toLowerCase().replace(/ /g, '-')}-type`}
        value={markerProps?.type || 'none'}
        onChange={(v: string) => onChange('type', v)}
        placeholder="Type"
        label="Type"
        className="small"
      >
        <SelectItem value="none">None</SelectItem>
        <SelectItem value="arrow">Arrow</SelectItem>
        <SelectItem value="arrowclosed">Arrow Closed</SelectItem>
      </SelectFieldset>
      <fieldset className={`Fieldset`}>
        <label className="Label">Color</label>
        <ColorPicker
          initialColor={markerProps?.color || '#000000'}
          buttonTitle={`${label} Color`}
          onChange={onColorChange}
        />
      </fieldset>
      <SliderFieldset
        name={`${label.toLowerCase().replace(/ /g, '-')}-width`}
        value={markerProps?.width ?? 10}
        onChange={(v: number) => {
          onChange('width', v);
        }}
        label="Width"
        required={false}
        min={1}
        max={30}
        step={1}
        sliderWidth={sliderWidth}
      />
      <SliderFieldset
        name={`${label.toLowerCase().replace(/ /g, '-')}-stroke-width`}
        value={markerProps?.strokeWidth ?? 1}
        onChange={(v: number) => onChange('strokeWidth', v)}
        label="Thickness"
        required={false}
        min={1}
        max={10}
        step={1}
        sliderWidth={sliderWidth}
      />
    </div>
  );
};

//
//
//

export const EdgeMenu = ({
  eid,
  position,
  setRenderProps,
}: {
  eid: string;
  position: [number, number];
  setRenderProps: (props: TEdgeRenderProps) => void;
}) => {
  //

  const wrapperStyle: CSSProperties = {
    top: 0,
    left: 0,
    transform: `translate(${position[0]}px, ${position[1]}px) translate(-50%, -50%)`,
    position: 'absolute',
    width: 'fit-content',
  };

  const renderProps: TEdgeRenderProps = useSharedData<TCoreSharedData>(
    ['edges'],
    (sd) => {
      const edge = sd.edges.find((e) => edgeId(e) === eid);
      const renderProps = (edge as any)?.renderProps;
      return renderProps || {};
    }
  );

  // Handlers
  const handleShapeChange = useCallback(
    (v: string) => {
      setRenderProps({ ...renderProps, edgeShape: v as any });
    },
    [renderProps, setRenderProps]
  );

  const handleStrokeColorChange = useCallback(
    (color: any) => {
      setRenderProps({
        ...renderProps,
        style: { ...renderProps.style, stroke: color.hex },
      });
    },
    [renderProps, setRenderProps]
  );

  const handleDashStyleChange = useCallback(
    (v: string) => {
      setRenderProps({
        ...renderProps,
        style: { ...renderProps.style, strokeDasharray: v },
      });
    },
    [renderProps, setRenderProps]
  );

  // Marker handlers
  const handleMarkerChange = useCallback(
    (key: 'markerStart' | 'markerEnd', field: string, value: any) => {
      setRenderProps({
        ...renderProps,
        [key]: { ...renderProps[key], [field]: value },
      });
    },
    [renderProps, setRenderProps]
  );

  const handleMarkerColorChange = useCallback(
    (key: 'markerStart' | 'markerEnd', color: any) => {
      setRenderProps({
        ...renderProps,
        [key]: { ...renderProps[key], color: color.hex },
      });
    },
    [renderProps, setRenderProps]
  );

  return (
    <div
      className="edge-menu-wrapper node-header-background"
      style={wrapperStyle}
    >
      {/* Edge controls row */}
      <div className="edge-menu-row">
        <span className="edge-menu-label">Edge</span>
        <fieldset className={`Fieldset`}>
          <label className="Label">Color</label>
          <ColorPicker
            initialColor={renderProps.style?.stroke || '#000000'}
            buttonTitle="Pick Edge Color"
            onChange={handleStrokeColorChange}
          />
        </fieldset>
        <SelectFieldset
          name="edge-shape"
          value={renderProps.edgeShape || ''}
          onChange={handleShapeChange}
          placeholder="Shape"
          label="Shape"
          className="small"
        >
          {EDGE_SHAPES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectFieldset>
        <SliderFieldset
          name="edge-thickness"
          value={Number(renderProps.style?.strokeWidth ?? 1)}
          onChange={(v: number) =>
            setRenderProps({
              ...renderProps,
              style: {
                ...renderProps.style,
                strokeWidth: `${v}`,
              },
            })
          }
          label="Thickness"
          required={false}
          min={1}
          max={10}
          step={1}
          sliderWidth={sliderWidth}
        />
        <SelectFieldset
          name="edge-dash"
          value={String(renderProps.style?.strokeDasharray || '')}
          onChange={handleDashStyleChange}
          placeholder="Dashed"
          label="Dashed"
          className="small"
        >
          {DASH_STYLES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectFieldset>
      </div>
      {/* Marker Start row */}
      <MarkerEditor
        label="Marker Start"
        markerProps={renderProps.markerStart}
        onChange={(field, value) =>
          handleMarkerChange('markerStart', field, value)
        }
        onColorChange={(color) => handleMarkerColorChange('markerStart', color)}
      />
      {/* Marker End row */}
      <MarkerEditor
        label="Marker End"
        markerProps={renderProps.markerEnd}
        onChange={(field, value) =>
          handleMarkerChange('markerEnd', field, value)
        }
        onColorChange={(color) => handleMarkerColorChange('markerEnd', color)}
      />
    </div>
  );
};

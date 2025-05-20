import { ReactFlowState, useStore } from '@xyflow/react';
import { CSSProperties, ReactNode, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { ColorPicker } from '@monorepo/ui-base';
import { SelectFieldset, SelectItem, TextFieldset } from '@monorepo/ui-base';

import { TEdgeRenderProps } from '../../../apis/types/edge';

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

// MarkerEditor: reusable component for marker start/end
type MarkerEditorProps = {
  label: string;
  markerProps?: {
    color?: string;
    width?: number;
    height?: number;
    strokeWidth?: number;
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
      <fieldset className={`Fieldset`}>
        <label className="Label">Color</label>
        <ColorPicker
          initialColor={markerProps?.color || '#672aa4'}
          buttonTitle={`${label} Color`}
          onChange={onColorChange}
        />
      </fieldset>
      <TextFieldset
        name={`${label.toLowerCase().replace(/ /g, '-')}-width`}
        value={String(markerProps?.width ?? 10)}
        onChange={(e) => onChange('width', Number(e.target.value))}
        type="number"
        placeholder="Width"
        label="Width"
        required={false}
        min={1}
        max={30}
      />
      <TextFieldset
        name={`${label.toLowerCase().replace(/ /g, '-')}-height`}
        value={String(markerProps?.height ?? 10)}
        onChange={(e) => onChange('height', Number(e.target.value))}
        type="number"
        placeholder="Height"
        label="Height"
        required={false}
        min={1}
        max={30}
      />
      <TextFieldset
        name={`${label.toLowerCase().replace(/ /g, '-')}-stroke-width`}
        value={String(markerProps?.strokeWidth ?? 1)}
        onChange={(e) => onChange('strokeWidth', Number(e.target.value))}
        type="number"
        placeholder="Thickness"
        label="Thickness"
        required={false}
        min={1}
        max={10}
      />
    </div>
  );
};

//
//
//

export const EdgeMenu = ({
  position,
  renderProps,
  setRenderProps,
}: {
  position: [number, number];
  renderProps: TEdgeRenderProps;
  setRenderProps: (props: TEdgeRenderProps) => void;
}) => {
  const wrapperStyle: CSSProperties = {
    transform: `translate(${position[0]}px, ${position[1]}px) translate(-50%, -50%)`,
    position: 'absolute',
    width: 'fit-content',
    zIndex: 1000,
  };

  // Handlers
  const handleShapeChange = useCallback(
    (v: string) => {
      setRenderProps({ ...renderProps, edgeShape: v as any });
    },
    [renderProps, setRenderProps]
  );

  const handleStrokeWidthChangeFieldset = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRenderProps({
        ...renderProps,
        style: {
          ...renderProps.style,
          strokeWidth: `${Number(e.target.value)}`,
        },
      });
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
    <EdgeToolbarPortal>
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
              initialColor={renderProps.style?.stroke || '#672aa4'}
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
          <TextFieldset
            name="edge-thickness"
            value={String(renderProps.style?.strokeWidth ?? 1)}
            onChange={handleStrokeWidthChangeFieldset}
            type="number"
            placeholder="Thickness"
            label="Thickness"
            required={false}
            min={1}
            max={10}
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
          onColorChange={(color) =>
            handleMarkerColorChange('markerStart', color)
          }
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
    </EdgeToolbarPortal>
  );
};

//

const selector = (state: ReactFlowState) =>
  state.domNode?.querySelector('.react-flow__renderer');

//

export function EdgeToolbarPortal({ children }: { children: ReactNode }) {
  const wrapperRef = useStore(selector);

  if (!wrapperRef) {
    return null;
  }

  return createPortal(children, wrapperRef);
}

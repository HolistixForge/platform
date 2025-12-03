import { CSSProperties } from 'react';

import { ColorPicker } from '@holistix/ui-base';
import { SelectFieldset, SelectItem, SliderFieldset } from '@holistix/ui-base';
import { useLocalSharedData } from '@holistix/collab/frontend';
import { TCoreSharedData } from '@holistix/core-graph';

import { edgeId, TEdgeRenderProps } from '../../apis/types/edge';

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

const sliderWidth = '80px';

// MarkerEditor: reusable component for marker start/end
// type MarkerEditorProps = {
//   label: string;
//   markerProps?: {
//     color?: string;
//     width?: number;
//     height?: number;
//     strokeWidth?: number;
//     type?: string;
//   };
//   onChange: (field: string, value: any) => void;
// };

// const MarkerEditor = ({ label, markerProps, onChange }: MarkerEditorProps) => {
//   return (
//     <div className="edge-menu-row">
//       <span className="edge-menu-label">{label}</span>
//       <SelectFieldset ... />
//       <SliderFieldset ... />
//       <SliderFieldset ... />
//     </div>
//   );
// };

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

  const renderProps: TEdgeRenderProps = useLocalSharedData<TCoreSharedData>(
    ['core-graph:edges'],
    (sd) => {
      const edge = sd['core-graph:edges'].find((e) => edgeId(e) === eid);
      const renderProps = (edge as any)?.renderProps;
      return renderProps || {};
    }
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
            initialColor={renderProps.style?.stroke || '#ffffff'}
            buttonTitle="Pick Edge Color"
            onChange={(color: any) => {
              setRenderProps({
                ...renderProps,
                style: { ...renderProps.style, stroke: color.hex },
                markerStart: {
                  type: 'none' as any,
                  ...renderProps.markerStart,
                  color: color.hex,
                },
                markerEnd: {
                  type: 'none' as any,
                  ...renderProps.markerEnd,
                  color: color.hex,
                },
              });
            }}
          />
        </fieldset>
        <SelectFieldset
          name="edge-shape"
          value={renderProps.edgeShape || ''}
          onChange={(v: string) => {
            setRenderProps({ ...renderProps, edgeShape: v as any });
          }}
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
          max={100}
          step={1}
          sliderWidth={sliderWidth}
        />
        <SelectFieldset
          name="edge-dash"
          value={String(renderProps.style?.strokeDasharray || '')}
          onChange={(v: string) => {
            setRenderProps({
              ...renderProps,
              style: { ...renderProps.style, strokeDasharray: v },
            });
          }}
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
      {/* Marker controls row (shared width/thickness, separate type) */}
      <div className="edge-menu-row">
        <span className="edge-menu-label">Markers</span>
        {/* Marker Start Type */}
        <SelectFieldset
          name="marker-start-type"
          value={renderProps.markerStart?.type || 'none'}
          onChange={(v: string) =>
            setRenderProps({
              ...renderProps,
              markerStart: { ...renderProps.markerStart, type: v as any },
            })
          }
          placeholder="Start Type"
          label="Start Type"
          className="small"
        >
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="arrow">Arrow</SelectItem>
          <SelectItem value="arrowclosed">Arrow Closed</SelectItem>
        </SelectFieldset>
        {/* Marker End Type */}
        <SelectFieldset
          name="marker-end-type"
          value={renderProps.markerEnd?.type || 'none'}
          onChange={(v: string) =>
            setRenderProps({
              ...renderProps,
              markerEnd: { ...renderProps.markerEnd, type: v as any },
            })
          }
          placeholder="End Type"
          label="End Type"
          className="small"
        >
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="arrow">Arrow</SelectItem>
          <SelectItem value="arrowclosed">Arrow Closed</SelectItem>
        </SelectFieldset>
        {/* Shared Width */}
        <SliderFieldset
          name="marker-width"
          value={
            renderProps.markerStart?.width ?? renderProps.markerEnd?.width ?? 10
          }
          onChange={(v: number) =>
            setRenderProps({
              ...renderProps,
              markerStart: {
                type: 'none' as any,
                ...renderProps.markerStart,
                width: v,
              },
              markerEnd: {
                type: 'none' as any,
                ...renderProps.markerEnd,
                width: v,
              },
            })
          }
          label="Width"
          required={false}
          min={1}
          max={30}
          step={1}
          sliderWidth={sliderWidth}
        />
        {/* Shared Thickness */}
        <SliderFieldset
          name="marker-thickness"
          value={
            renderProps.markerStart?.strokeWidth ??
            renderProps.markerEnd?.strokeWidth ??
            1
          }
          onChange={(v: number) =>
            setRenderProps({
              ...renderProps,
              markerStart: {
                type: 'none' as any,
                ...renderProps.markerStart,
                strokeWidth: v,
              },
              markerEnd: {
                type: 'none' as any,
                ...renderProps.markerEnd,
                strokeWidth: v,
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
      </div>
    </div>
  );
};

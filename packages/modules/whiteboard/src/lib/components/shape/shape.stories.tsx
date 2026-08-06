import type { Meta, StoryObj } from '@storybook/react';

import { TGraphNode } from '@holistix-forge/core-graph';

import { Shape } from './shape';
import { MockNodeContext } from '../node-wrappers/node-wrapper';
import { StoryMockSpaceContextReactflowBgAndCss } from '../../stories/story-context-mocks';
import { SHAPE_TYPES, TShapeType } from '../../whiteboard-events';

// `shape` is one of the two nodes whiteboard registers itself — `group` is the
// other — and it had no story at all, so nothing showed when it stopped
// working. It is registered under the plain key `shape` in `frontend.ts`,
// which is why it is easy to miss when reading the module list.
//
// Everything a whiteboard node needs comes from two contexts: the space, and
// the node's own. `MockNodeContext` is exported from this package's stories
// entry point precisely for this, and without it the component throws on
// `useNodeContext` before it can draw anything.

const node = (data: Record<string, unknown>): TGraphNode =>
  ({
    id: 'shape-story',
    name: 'shape-story',
    root: true,
    type: 'shape',
    connectors: [],
    data,
  } as unknown as TGraphNode);

const StoryWrapper = ({
  shapeType,
  borderColor,
  fillColor,
  fillOpacity,
}: {
  shapeType: TShapeType;
  borderColor: string;
  fillColor: string;
  fillOpacity: number;
}) => (
  <StoryMockSpaceContextReactflowBgAndCss nodeId="shape-story">
    <MockNodeContext>
      <div style={{ width: '220px', height: '220px', position: 'relative' }}>
        <Shape
          node={node({ shapeType, borderColor, fillColor, fillOpacity })}
        />
      </div>
    </MockNodeContext>
  </StoryMockSpaceContextReactflowBgAndCss>
);

const meta = {
  title: 'Modules/Whiteboard/Nodes/Shape',
  component: StoryWrapper,
  parameters: { layout: 'centered' },
  argTypes: {
    shapeType: {
      control: 'inline-radio',
      options: Object.values(SHAPE_TYPES),
    },
    borderColor: { control: 'color' },
    fillColor: { control: 'color' },
    // A percentage, not a fraction: the component divides by 100 before
    // building the colour. Passing 0.6 here means 0.6%, which is invisible —
    // and looks exactly like a fill that does not work.
    fillOpacity: { control: { type: 'range', min: 0, max: 100, step: 5 } },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

/** What you get from the menu: an outline, no fill. */
export const Circle: Story = {
  args: {
    shapeType: SHAPE_TYPES.CIRCLE,
    borderColor: '#672aa4',
    fillColor: '#672aa4',
    fillOpacity: 0,
  },
};

export const Filled: Story = {
  args: {
    shapeType: SHAPE_TYPES.CIRCLE,
    borderColor: '#672aa4',
    fillColor: '#672aa4',
    fillOpacity: 60,
  },
};

// The defaults come from destructuring in the component, not from the caller,
// so a node whose data was never written still has to draw. That is the state
// a shape is in the instant it is created.
export const NoData: Story = {
  args: {} as never,
};

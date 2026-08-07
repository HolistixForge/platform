import type { Meta, StoryObj } from '@storybook/react';

import { TGraphNode } from '@holistix-forge/core-graph';

import { Group } from './group';
import { MockNodeContext } from '../node-wrappers/node-wrapper';
import { StoryMockSpaceContextReactflowBgAndCss } from '../../stories/story-context-mocks';

// The other node whiteboard registers itself, beside `shape`, and the other one
// with no story. A group is the container people drop nodes into, so it is the
// one node whose whole job is to be behind other things.

const node = (data: Record<string, unknown>): TGraphNode =>
  ({
    id: 'group-story',
    name: 'group-story',
    root: true,
    type: 'group',
    connectors: [],
    data,
  } as unknown as TGraphNode);

const StoryWrapper = ({
  title,
  borderColor,
  fillColor,
  fillOpacity,
}: {
  title: string;
  borderColor: string;
  fillColor: string;
  fillOpacity: number;
}) => (
  <StoryMockSpaceContextReactflowBgAndCss nodeId="group-story">
    <MockNodeContext>
      <div style={{ width: '320px', height: '240px', position: 'relative' }}>
        <Group node={node({ title, borderColor, fillColor, fillOpacity })} />
      </div>
    </MockNodeContext>
  </StoryMockSpaceContextReactflowBgAndCss>
);

const meta = {
  title: 'Modules/Whiteboard/Components/Nodes/Group',
  component: StoryWrapper,
  parameters: { layout: 'centered' },
  argTypes: {
    borderColor: { control: 'color' },
    fillColor: { control: 'color' },
    // A percentage, like `shape`: the component divides by 100 before building
    // the colour, so a fraction here renders as very nearly nothing.
    fillOpacity: { control: { type: 'range', min: 0, max: 100, step: 5 } },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

/** What the menu creates: an outline you can drop nodes into. */
export const Normal: Story = {
  args: {
    title: 'Group Name',
    borderColor: '#672aa4',
    fillColor: '#672aa4',
    fillOpacity: 0,
  },
};

export const Filled: Story = {
  args: {
    title: 'Data pipeline',
    borderColor: '#45AFDD',
    fillColor: '#45AFDD',
    fillOpacity: 20,
  },
};

// A title long enough to have to do something. Groups are named by hand and
// nothing stops a long one.
export const LongTitle: Story = {
  args: {
    title: 'Everything that has to run before the nightly export can start',
    borderColor: '#672aa4',
    fillColor: '#672aa4',
    fillOpacity: 0,
  },
};

// The state a group is in the instant it is created, before its data is
// written: the defaults live in the component, not in the caller.
export const NoData: Story = {
  args: {} as never,
};

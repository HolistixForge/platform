import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';

import { Sidebar } from './Sidebar';
import { icons } from '../assets/icons';

/**
 * The rail is `position: fixed` in both shapes, so on its own it would escape
 * the story and pin itself to the preview iframe. Each story is wrapped in a
 * box that contains it and stands in for a page, which is the only way the
 * difference between the two shapes is visible at all: `dashboard` owns a
 * column and the content is indented past it, `island` floats over content
 * that gives up nothing.
 */
const Page = ({
  children,
  indent,
}: {
  children: ReactNode;
  indent: boolean;
}) => (
  <div
    style={{
      // `transform` makes this the containing block for `position: fixed`
      // descendants — the one way to scope a fixed element without changing
      // the component under test.
      transform: 'translate(0)',
      position: 'relative',
      width: 720,
      height: 420,
      background: 'var(--surface-900, #0b0d17)',
      border: '1px solid #2a2f45',
      overflow: 'hidden',
    }}
  >
    {children}
    <div
      style={{
        height: '100%',
        boxSizing: 'border-box',
        paddingLeft: indent ? 'var(--holistix-sidebar-width, 56px)' : 0,
        color: '#8b90a8',
        font: '14px system-ui',
      }}
    >
      <div style={{ padding: 16 }}>
        {indent
          ? 'Page content, indented past the bar.'
          : 'Page content, full width. The island floats over it.'}
      </div>
    </div>
  </div>
);

const meta = {
  title: 'Base/Components/Sidebar',
  component: Sidebar,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'radio',
      options: ['dashboard', 'island'],
      description:
        'dashboard: a full-height bar docked left. island: a floating box.',
    },
  },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof Sidebar>;

const items = [
  { title: 'planet', Icon: icons.Planet },
  { title: 'solar system', Icon: icons.SolarSystem },
  { title: 'galaxy', Icon: icons.Galaxy },
  { title: 'notebook', Icon: icons.NodeMother },
  { title: 'tree', Icon: icons.Tree },
  { title: 'biome', Icon: icons.Biome },
  { title: 'seed', Icon: icons.Seed },
  { title: 'artefact', Icon: icons.Artefact },
  { title: 'agora', Icon: icons.Agora },
  { title: 'authorizations', Icon: icons.Key },
];

/** The shape the project editor uses: a bar, flush left, full height. */
export const Dashboard: Story = {
  args: { items, active: 'galaxy', variant: 'dashboard' },
  render: (args) => (
    <Page indent>
      <Sidebar {...args} />
    </Page>
  ),
};

/** The floating shape, for a surface with no column to give up. */
export const Island: Story = {
  args: { items, active: 'galaxy', variant: 'island' },
  render: (args) => (
    <Page indent={false}>
      <Sidebar {...args} />
    </Page>
  ),
};

/**
 * One item, which is what the project editor actually renders today. Worth its
 * own story: a single icon is where the island shape reads as a stray floating
 * square rather than as navigation.
 */
export const SingleItem: Story = {
  args: {
    items: [{ title: 'project-main', Icon: icons.NodeMother }],
    active: 'project-main',
    variant: 'dashboard',
  },
  render: (args) => (
    <Page indent>
      <Sidebar {...args} />
    </Page>
  ),
};

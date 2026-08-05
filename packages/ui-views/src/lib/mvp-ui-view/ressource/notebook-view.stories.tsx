import type { Meta, StoryObj } from '@storybook/react';

import { NotebookView } from './notebook-view';

// This file used to hold four stories — Stop, Load, Running, Host — differing
// only in a `status` prop. All four rendered identical DOM and identical
// pixels, verified by hashing both. `status` is read only under
// `activeView === 'biome-notebook'`, a view nothing could reach: the component
// opened on `biome-server`, which has no content block, and the only setter
// out of it lived inside a branch you had to already be in.
//
// So the stories vary the screen first, and the status inside the one screen
// that reads it.

const meta = {
  title: 'Mvp/Resource/Notebook/NotebookView',
  component: NotebookView,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    view: {
      control: 'inline-radio',
      options: ['biome-server', 'biome-server-view', 'biome-notebook'],
    },
    status: {
      control: 'inline-radio',
      options: ['running', 'loading', 'stopped', 'hosted'],
    },
  },
} satisfies Meta<typeof NotebookView>;

export default meta;

type Story = StoryObj<typeof NotebookView>;

/** The screen as it opens: chrome, sidebar, and an empty column. */
export const ServerList: Story = {
  args: { status: 'running', view: 'biome-server' },
};

/** The only view with a content block — tags, descriptions, list, accesses. */
export const ServerDetail: Story = {
  args: { status: 'running', view: 'biome-server-view' },
};

// The four below differ from each other, which the previous four did not.

export const NotebookRunning: Story = {
  args: { status: 'running', view: 'biome-notebook' },
};

export const NotebookLoading: Story = {
  args: { status: 'loading', view: 'biome-notebook' },
};

export const NotebookStopped: Story = {
  args: { status: 'stopped', view: 'biome-notebook' },
};

export const NotebookHosted: Story = {
  args: { status: 'hosted', view: 'biome-notebook' },
};

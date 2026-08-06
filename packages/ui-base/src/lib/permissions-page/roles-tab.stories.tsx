import type { Meta, StoryObj } from '@storybook/react';

import { RolesTab } from './roles-tab';
import { mockRoles } from './permissions-mocks';

import './permissions-page.scss';

const asyncNoop = async () => undefined;

const meta = {
  title: 'Base/Views/PermissionsPage/RolesTab',
  component: RolesTab,
  parameters: { layout: 'fullscreen' },
  args: {
    roles: mockRoles,
    loading: false,
    onCreateRole: asyncNoop,
    onUpdateRole: asyncNoop,
    onDeleteRole: asyncNoop,
  },
  decorators: [
    (Story) => (
      <div style={{ height: '640px', width: '1000px', padding: '24px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RolesTab>;

export default meta;

type Story = StoryObj<typeof RolesTab>;

export const Normal: Story = {};

export const ReadOnly: Story = {
  args: { readonly: true },
};

export const Loading: Story = {
  args: { roles: [], loading: true },
};

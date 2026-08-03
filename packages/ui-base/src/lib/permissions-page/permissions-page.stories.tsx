import type { Meta, StoryObj } from '@storybook/react';

import { PermissionsPage } from './permissions-page';
import { mockMembers, mockRoles, mockUserRoles } from './permissions-mocks';

const asyncNoop = async () => undefined;

const meta = {
  title: 'Users/PermissionsPage',
  component: PermissionsPage,
  parameters: { layout: 'fullscreen' },
  args: {
    roles: mockRoles,
    rolesLoading: false,
    members: mockMembers,
    membersLoading: false,
    userRoles: mockUserRoles,
    userRolesLoading: false,
    onCreateRole: asyncNoop,
    onUpdateRole: asyncNoop,
    onDeleteRole: asyncNoop,
    onAssignRole: asyncNoop,
    onRemoveRole: asyncNoop,
  },
  decorators: [
    (Story) => (
      <div style={{ height: '760px', width: '1100px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PermissionsPage>;

export default meta;

type Story = StoryObj<typeof PermissionsPage>;

export const RolesTabDefault: Story = {};

export const UsersTabDefault: Story = {
  args: {
    defaultTab: 'users',
  },
};

/** A member without `org:admin` sees the page but cannot mutate anything. */
export const ReadOnly: Story = {
  args: {
    readonly: true,
    defaultTab: 'users',
  },
};

export const Loading: Story = {
  args: {
    roles: [],
    rolesLoading: true,
    members: [],
    membersLoading: true,
    userRoles: {},
    userRolesLoading: true,
  },
};

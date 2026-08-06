import type { Meta, StoryObj } from '@storybook/react';

import { UsersTab } from './users-tab';
import { mockMembers, mockRoles, mockUserRoles } from './permissions-mocks';

import './permissions-page.scss';

const asyncNoop = async () => undefined;

const getUserRoles = (user_id: string) =>
  mockUserRoles[user_id]?.org_roles ?? [];

const meta = {
  title: 'Base/Views/PermissionsPage/UsersTab',
  component: UsersTab,
  parameters: { layout: 'fullscreen' },
  args: {
    members: mockMembers,
    membersLoading: false,
    roles: mockRoles,
    rolesLoading: false,
    getUserRoles,
    onAssignRole: asyncNoop,
    onRemoveRole: asyncNoop,
  },
  decorators: [
    (Story) => (
      <div style={{ height: '640px', width: '1000px', padding: '24px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UsersTab>;

export default meta;

type Story = StoryObj<typeof UsersTab>;

export const Normal: Story = {};

export const ReadOnly: Story = {
  args: { readonly: true },
};

/** The organization has no member other than the owner. */
export const SingleMember: Story = {
  args: { members: [mockMembers[0]] },
};

export const Loading: Story = {
  args: {
    members: [],
    membersLoading: true,
    roles: [],
    rolesLoading: true,
  },
};

import type { Meta, StoryObj } from '@storybook/react';

import { UserRoleEditor } from './user-role-editor';
import { mockRoles } from './permissions-mocks';

import './permissions-page.scss';

const asyncNoop = async () => undefined;

const meta = {
  title: 'Base/Views/PermissionsPage/UserRoleEditor',
  component: UserRoleEditor,
  parameters: { layout: 'centered' },
  args: {
    user_id: 'user-2',
    username: 'alice',
    currentRoles: [mockRoles[1]],
    availableRoles: mockRoles,
    loading: false,
    onAssignRole: asyncNoop,
    onRemoveRole: asyncNoop,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '620px', padding: '24px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UserRoleEditor>;

export default meta;

type Story = StoryObj<typeof UserRoleEditor>;

export const Normal: Story = {};

/** `org:owner` is immutable — its badge has no remove button. */
export const ImmutableRole: Story = {
  args: {
    user_id: 'user-1',
    username: 'claude-test',
    currentRoles: [mockRoles[0]],
  },
};

export const NoRoleAssigned: Story = {
  args: {
    user_id: 'user-3',
    username: 'bob',
    currentRoles: [],
  },
};

export const ReadOnly: Story = {
  args: { readonly: true },
};

export const Loading: Story = {
  args: { loading: true },
};

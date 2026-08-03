import type { Meta, StoryObj } from '@storybook/react';
import { TCollaborator } from '@holistix-forge/types';

import { UserListItem } from './user-list-item';
import { ButtonBase } from '../buttons/buttonBase';

/** Static collaborators — no random avatar, so the snapshots stay stable. */
const owner: TCollaborator = {
  user_id: 'user-1',
  username: 'github:codeMaster99',
  firstname: 'Alice',
  lastname: 'Johnson',
  picture: null,
  scope: ['org:admin'],
  is_owner: true,
};

const member: TCollaborator = {
  user_id: 'user-2',
  username: 'local:bob',
  firstname: 'Bob',
  lastname: 'Smith',
  picture: null,
  scope: ['project:read'],
  is_owner: false,
};

const meta = {
  title: 'Users/UserListItem',
  component: UserListItem,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: '420px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UserListItem>;

export default meta;

type Story = StoryObj<typeof UserListItem>;

export const Normal: Story = {
  args: { collaborator: owner },
};

/** With an `onClick`, the row becomes a button (role + keyboard handling). */
export const Clickable: Story = {
  args: {
    collaborator: member,
    onClick: () => undefined,
  },
};

/** Trailing actions are rendered through `children`. */
export const WithActions: Story = {
  args: {
    collaborator: member,
    children: <ButtonBase text="Remove" callback={() => undefined} />,
  },
};

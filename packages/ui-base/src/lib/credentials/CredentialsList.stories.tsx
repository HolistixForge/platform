import type { Meta, StoryObj } from '@storybook/react';

import { CredentialsList } from './CredentialsList';
import { mockCredentialTypes, mockCredentials } from './credentials-mocks';

const noop = () => undefined;

const meta = {
  title: 'Credentials/CredentialsList',
  component: CredentialsList,
  parameters: { layout: 'centered' },
  args: {
    credentialTypes: mockCredentialTypes,
    onAdd: noop,
    onEdit: noop,
    onDelete: noop,
    onShare: noop,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '720px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CredentialsList>;

export default meta;

type Story = StoryObj<typeof CredentialsList>;

export const Filled: Story = {
  args: {
    credentials: mockCredentials,
  },
};

/** No credential yet — the empty state invites the user to add one. */
export const Empty: Story = {
  args: {
    credentials: [],
  },
};

export const Loading: Story = {
  args: {
    credentials: [],
    loading: true,
  },
};

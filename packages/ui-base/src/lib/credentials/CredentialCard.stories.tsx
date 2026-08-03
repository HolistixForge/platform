import type { Meta, StoryObj } from '@storybook/react';

import { CredentialCard } from './CredentialCard';
import { mockCredentialTypes, mockCredentials } from './credentials-mocks';

import './credentials.scss';

const noop = () => undefined;

const meta = {
  title: 'Credentials/CredentialCard',
  component: CredentialCard,
  parameters: { layout: 'centered' },
  args: {
    onEdit: noop,
    onDelete: noop,
    onShare: noop,
  },
  decorators: [
    (Story) => (
      <div className="credentials-wallet" style={{ width: '560px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CredentialCard>;

export default meta;

type Story = StoryObj<typeof CredentialCard>;

/** Shared credential, already used at least once. */
export const Shared: Story = {
  args: {
    credential: mockCredentials[0],
    credentialType: mockCredentialTypes[0],
  },
};

/** Private credential that has never been used. */
export const NeverUsed: Story = {
  args: {
    credential: mockCredentials[1],
    credentialType: mockCredentialTypes[1],
  },
};

/**
 * The credential type is unknown to the frontend (module not installed):
 * the card falls back to the raw type name and the default icon.
 */
export const UnknownType: Story = {
  args: {
    credential: mockCredentials[2],
    credentialType: undefined,
  },
};

/** No callback provided: the card renders without its action buttons. */
export const WithoutActions: Story = {
  args: {
    credential: mockCredentials[0],
    credentialType: mockCredentialTypes[0],
    onEdit: undefined,
    onDelete: undefined,
    onShare: undefined,
  },
};

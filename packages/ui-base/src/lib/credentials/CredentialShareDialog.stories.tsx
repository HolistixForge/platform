import type { Meta, StoryObj } from '@storybook/react';

import { CredentialShareDialog } from './CredentialShareDialog';
import {
  mockOrganizations,
  mockProjects,
  mockShares,
} from './credentials-mocks';

import './credentials.scss';

const asyncNoop = async () => undefined;

const meta = {
  title: 'Base/Resource/Credentials/CredentialShareDialog',
  component: CredentialShareDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    credentialId: 'cred-1',
    credentialName: 'OpenAI — production',
    organizations: mockOrganizations,
    projects: mockProjects,
    shares: [],
    onShare: asyncNoop,
    onRevoke: asyncNoop,
    onClose: () => undefined,
  },
} satisfies Meta<typeof CredentialShareDialog>;

export default meta;

type Story = StoryObj<typeof CredentialShareDialog>;

/** Credential not shared yet. */
export const NotShared: Story = {};

/**
 * Already shared with one organization and one project — those targets are
 * filtered out of the "add a share" selects.
 */
export const WithActiveShares: Story = {
  args: {
    shares: mockShares,
  },
};

export const Loading: Story = {
  args: {
    shares: mockShares,
    isLoading: true,
  },
};

import type { Meta, StoryObj } from '@storybook/react';

import { CredentialForm } from './CredentialForm';
import { mockCredentialTypes } from './credentials-mocks';

import './credentials.scss';

const noop = () => undefined;

const meta = {
  title: 'Base/Resource/Credentials/CredentialForm',
  component: CredentialForm,
  parameters: { layout: 'centered' },
  args: {
    types: mockCredentialTypes,
    onSubmit: noop,
    onCancel: noop,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '560px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CredentialForm>;

export default meta;

type Story = StoryObj<typeof CredentialForm>;

/** Nothing selected yet: only the type selector is shown. */
export const Normal: Story = {};

/**
 * A type is pre-selected, so the name and secret fields are revealed.
 * Submit stays disabled until both are filled.
 */
export const TypePreselected: Story = {
  args: {
    initialType: 'openai_api_key',
  },
};

export const Submitting: Story = {
  args: {
    initialType: 'github_token',
    isSubmitting: true,
  },
};
